/**
 * Reader for Steam's binary app info cache (appcache/appinfo.vdf).
 * Supports format versions 27, 28 and 29 (29 adds a shared key string table).
 */
export type BinValue = string | number | BinObject
export interface BinObject {
  [key: string]: BinValue
}

const MAGIC: Record<number, number> = {
  0x07564427: 27,
  0x07564428: 28,
  0x07564429: 29
}

export interface AppInfoFile {
  version: number
  apps: Map<number, BinObject>
}

export function parseAppInfo(buf: Buffer, wanted?: Set<number>): AppInfoFile {
  if (buf.length < 8) throw new Error('appinfo.vdf is too short')
  const magic = buf.readUInt32LE(0)
  const version = MAGIC[magic]
  if (!version) throw new Error(`Unsupported appinfo.vdf format (0x${magic.toString(16)})`)

  let pos = 8
  let strings: string[] | null = null
  let dataEnd = buf.length
  if (version >= 29) {
    const tableOffset = Number(buf.readBigInt64LE(8))
    pos = 16
    strings = readStringTable(buf, tableOffset)
    dataEnd = tableOffset
  }

  // Bytes between an entry's size field and its key-values:
  // info state (4), last updated (4), PICS token (8), text SHA-1 (20), change number (4)
  // and, from v28, binary SHA-1 (20).
  const entryHeader = version >= 28 ? 60 : 40
  const apps = new Map<number, BinObject>()

  while (pos + 8 <= dataEnd) {
    const appid = buf.readUInt32LE(pos)
    if (appid === 0) break
    const size = buf.readUInt32LE(pos + 4)
    const start = pos + 8
    const end = start + size
    if (end > dataEnd) break
    if (!wanted || wanted.has(appid)) {
      try {
        const reader = new BinaryReader(buf, start + entryHeader, end, strings)
        const root = reader.readObject()
        const info = root.appinfo
        apps.set(appid, info && typeof info === 'object' ? info : root)
      } catch {
        // A damaged entry shouldn't stop the rest of the file from loading.
      }
    }
    pos = end
  }
  return { version, apps }
}

function readStringTable(buf: Buffer, offset: number): string[] {
  if (offset <= 0 || offset + 4 > buf.length) throw new Error('appinfo.vdf string table is missing')
  const count = buf.readUInt32LE(offset)
  const out: string[] = new Array(count)
  let pos = offset + 4
  for (let k = 0; k < count; k++) {
    const zero = buf.indexOf(0, pos)
    if (zero === -1) throw new Error('appinfo.vdf string table is damaged')
    out[k] = buf.toString('utf8', pos, zero)
    pos = zero + 1
  }
  return out
}

class BinaryReader {
  constructor(
    private buf: Buffer,
    private pos: number,
    private end: number,
    private strings: string[] | null
  ) {}

  readObject(): BinObject {
    const obj: BinObject = {}
    while (this.pos < this.end) {
      const type = this.buf[this.pos++]
      if (type === 0x08 || type === 0x0b) return obj
      const key = this.readKey()
      switch (type) {
        case 0x00:
          obj[key] = this.readObject()
          break
        case 0x01:
          obj[key] = this.readCString()
          break
        case 0x02:
        case 0x04:
        case 0x06:
          obj[key] = this.buf.readInt32LE(this.pos)
          this.pos += 4
          break
        case 0x03:
          obj[key] = this.buf.readFloatLE(this.pos)
          this.pos += 4
          break
        case 0x05:
          obj[key] = this.readWideString()
          break
        case 0x07:
          obj[key] = this.buf.readBigUInt64LE(this.pos).toString()
          this.pos += 8
          break
        case 0x0a:
          obj[key] = this.buf.readBigInt64LE(this.pos).toString()
          this.pos += 8
          break
        default:
          throw new Error(`Unknown key-value type 0x${type.toString(16)}`)
      }
    }
    return obj
  }

  private readKey(): string {
    if (this.strings) {
      const index = this.buf.readUInt32LE(this.pos)
      this.pos += 4
      return this.strings[index] ?? `#${index}`
    }
    return this.readCString()
  }

  private readCString(): string {
    const zero = this.buf.indexOf(0, this.pos)
    if (zero === -1 || zero >= this.end) throw new Error('Unterminated string')
    const s = this.buf.toString('utf8', this.pos, zero)
    this.pos = zero + 1
    return s
  }

  private readWideString(): string {
    let stop = this.pos
    while (stop + 1 < this.end && (this.buf[stop] !== 0 || this.buf[stop + 1] !== 0)) stop += 2
    const s = this.buf.toString('utf16le', this.pos, stop)
    this.pos = stop + 2
    return s
  }
}

/** The fields of an app info entry that the app uses. */
export interface AppMeta {
  appid: number
  name: string | null
  type: string | null
  tagIds: number[]
  genreIds: number[]
  categoryIds: number[]
  reviewPercent: number | null
  controller: 'full' | 'partial' | null
  deck: 0 | 1 | 2 | 3
  releaseDate: number | null
  developer: string | null
}

function child(obj: BinValue | undefined, key: string): BinValue | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  if (key in obj) return obj[key]
  const lower = key.toLowerCase()
  const match = Object.keys(obj).find((k) => k.toLowerCase() === lower)
  return match === undefined ? undefined : obj[match]
}

function asNumber(value: BinValue | undefined): number | null {
  if (value === undefined || typeof value === 'object') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asString(value: BinValue | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Values of a {"0": x, "1": y} list in index order. */
function listNumbers(value: BinValue | undefined): number[] {
  if (!value || typeof value !== 'object') return []
  return Object.keys(value)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => asNumber(value[k]))
    .filter((n): n is number => n !== null)
}

export function extractMeta(appid: number, info: BinObject): AppMeta {
  const common = child(info, 'common')
  const type = asString(child(common, 'type'))

  const categoryIds: number[] = []
  const category = child(common, 'category')
  if (category && typeof category === 'object') {
    for (const [key, value] of Object.entries(category)) {
      const match = /^category_(\d+)$/i.exec(key)
      if (match && Number(value) !== 0) categoryIds.push(Number(match[1]))
    }
  }

  const controllerRaw = asString(child(common, 'controller_support'))?.toLowerCase()
  const deckRaw = asNumber(child(child(common, 'steam_deck_compatibility'), 'category')) ?? 0

  let developer: string | null = null
  const associations = child(common, 'associations')
  if (associations && typeof associations === 'object') {
    for (const entry of Object.values(associations)) {
      if (entry && typeof entry === 'object' && asString(child(entry, 'type')) === 'developer') {
        developer = asString(child(entry, 'name'))
        if (developer) break
      }
    }
  }

  const release =
    asNumber(child(common, 'steam_release_date')) ?? asNumber(child(common, 'original_release_date'))

  return {
    appid,
    name: asString(child(common, 'name')),
    type: type ? type.toLowerCase() : null,
    tagIds: listNumbers(child(common, 'store_tags')),
    genreIds: listNumbers(child(common, 'genres')),
    categoryIds,
    reviewPercent: asNumber(child(common, 'review_percentage')),
    controller: controllerRaw === 'full' ? 'full' : controllerRaw === 'partial' ? 'partial' : null,
    deck: deckRaw >= 0 && deckRaw <= 3 ? (deckRaw as 0 | 1 | 2 | 3) : 0,
    releaseDate: release && release > 0 ? release : null,
    developer
  }
}
