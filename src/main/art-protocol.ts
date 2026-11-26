import { net, protocol } from 'electron'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { CacheStore } from './data/cache'
import { getBinary } from './online/http'
import { ART_KINDS, type ArtKind, type LocalArtIndex } from './steam/artwork'

export const SCHEME = 'nextup'

/** Must run before the app is ready. */
export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/'
const CDN_FILES: Record<ArtKind, string> = {
  header: 'header.jpg',
  cover: 'library_600x900.jpg',
  hero: 'library_hero.jpg',
  logo: 'logo.png'
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

function mimeFor(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

const notFound = (): Response => new Response(null, { status: 404 })

/** Runs at most `limit` downloads at a time so a big library grid doesn't flood the network. */
function limiter(limit: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0
  const waiting: (() => void)[] = []
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve))
    active++
    try {
      return await task()
    } finally {
      active--
      waiting.shift()?.()
    }
  }
}

export interface ArtDeps {
  artDir: string
  cache: CacheStore
  getLocalIndex: () => LocalArtIndex
  /** Avatar file for an account, from Steam's own cache or a downloaded copy. */
  getAvatarFile: (steamId: string) => string | null
}

/**
 * Serves nextup://art/<appid>/<kind> and nextup://avatar/<steamid>.
 * Artwork comes from Steam's own cache first, then from earlier downloads,
 * then from Steam's CDN when online (saved for next time).
 */
export function createArtHandler(deps: ArtDeps): (request: Request) => Promise<Response> {
  const misses = new Set<string>()
  const inflight = new Map<string, Promise<string | null>>()
  const queue = limiter(6)

  const serveFile = async (path: string): Promise<Response> => {
    try {
      const data = await readFile(path)
      return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': mimeFor(path), 'Cache-Control': 'max-age=86400' }
      })
    } catch {
      return notFound()
    }
  }

  const download = (appid: number, kind: ArtKind): Promise<string | null> => {
    const key = `${appid}/${kind}`
    let pending = inflight.get(key)
    if (!pending) {
      pending = queue(async () => {
        const details = deps.cache.data.details[appid]
        const urls = [details?.assets?.[kind as 'header' | 'cover' | 'hero'], CDN + appid + '/' + CDN_FILES[kind]]
        for (const url of urls) {
          if (!url) continue
          const image = await getBinary(url)
          if (!image) continue
          const ext = image.type.includes('png') ? '.png' : '.jpg'
          const dir = join(deps.artDir, String(appid))
          await mkdir(dir, { recursive: true })
          const file = join(dir, kind + ext)
          await writeFile(file, image.data)
          return file
        }
        return null
      }).finally(() => inflight.delete(key))
      inflight.set(key, pending)
    }
    return pending
  }

  const findDownloaded = async (appid: number, kind: ArtKind): Promise<string | null> => {
    for (const ext of ['.jpg', '.png']) {
      const file = join(deps.artDir, String(appid), kind + ext)
      try {
        await access(file)
        return file
      } catch {
        // Try the next extension.
      }
    }
    return null
  }

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)

    if (url.host === 'avatar') {
      const steamId = parts[0]
      if (!/^\d{17}$/.test(steamId ?? '')) return notFound()
      const file = deps.getAvatarFile(steamId)
      return file ? serveFile(file) : notFound()
    }

    if (url.host !== 'art') return notFound()
    const appid = Number(parts[0])
    const kind = parts[1] as ArtKind
    if (!Number.isInteger(appid) || appid <= 0 || !ART_KINDS.includes(kind)) return notFound()

    const local = await deps.getLocalIndex().find(appid, kind)
    if (local) return serveFile(local)

    const saved = await findDownloaded(appid, kind)
    if (saved) return serveFile(saved)

    const key = `${appid}/${kind}`
    if (misses.has(key) || !net.isOnline()) return notFound()
    const downloaded = await download(appid, kind)
    if (downloaded) return serveFile(downloaded)
    misses.add(key)
    return notFound()
  }
}
