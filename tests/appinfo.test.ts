import { describe, expect, it } from 'vitest'
import { extractMeta, parseAppInfo } from '../src/main/steam/appinfo'

type Kv = { [key: string]: string | number | Kv }

/** Writes a minimal appinfo.vdf in the given format version. */
function buildAppInfo(version: 28 | 29, apps: { appid: number; data: Kv }[]): Buffer {
  const strings: string[] = []
  const cstr = (s: string): Buffer => Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])])
  const u32 = (n: number): Buffer => {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(n)
    return b
  }
  const key = (k: string): Buffer => {
    if (version === 28) return cstr(k)
    let index = strings.indexOf(k)
    if (index === -1) index = strings.push(k) - 1
    return u32(index)
  }
  const encode = (obj: Kv): Buffer => {
    const parts: Buffer[] = []
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'object') parts.push(Buffer.from([0x00]), key(k), encode(v), Buffer.from([0x08]))
      else if (typeof v === 'string') parts.push(Buffer.from([0x01]), key(k), cstr(v))
      else parts.push(Buffer.from([0x02]), key(k), u32(v))
    }
    return Buffer.concat(parts)
  }

  const header = Buffer.alloc(version === 29 ? 16 : 8)
  header.writeUInt32LE(version === 29 ? 0x07564429 : 0x07564428, 0)
  header.writeUInt32LE(1, 4)

  const entries: Buffer[] = []
  for (const app of apps) {
    const kv = Buffer.concat([encode({ appinfo: app.data }), Buffer.from([0x08])])
    const body = Buffer.concat([Buffer.alloc(60), kv])
    entries.push(u32(app.appid), u32(body.length), body)
  }
  entries.push(u32(0))

  const data = Buffer.concat([header, ...entries])
  if (version === 28) return data
  data.writeBigInt64LE(BigInt(data.length), 8)
  return Buffer.concat([data, u32(strings.length), ...strings.map(cstr)])
}

const portal: Kv = {
  appid: 620,
  common: {
    name: 'Portal 2',
    type: 'Game',
    store_tags: { '0': 1664, '1': 3843, '2': 1685 },
    genres: { '0': 1, '1': 25 },
    category: { category_2: 1, category_9: 1, category_28: 1 },
    review_percentage: 98,
    controller_support: 'full',
    steam_deck_compatibility: { category: 3 },
    steam_release_date: 1303171200,
    associations: { '0': { type: 'publisher', name: 'Valve' }, '1': { type: 'developer', name: 'Valve' } }
  }
}

describe('parseAppInfo', () => {
  for (const version of [28, 29] as const) {
    it(`reads format version ${version}`, () => {
      const buf = buildAppInfo(version, [
        { appid: 620, data: portal },
        { appid: 228980, data: { common: { name: 'Steamworks Common Redistributables', type: 'Tool' } } }
      ])
      const file = parseAppInfo(buf)
      expect(file.version).toBe(version)
      expect(file.apps.size).toBe(2)

      const meta = extractMeta(620, file.apps.get(620)!)
      expect(meta).toEqual({
        appid: 620,
        name: 'Portal 2',
        type: 'game',
        tagIds: [1664, 3843, 1685],
        genreIds: [1, 25],
        categoryIds: [2, 9, 28],
        reviewPercent: 98,
        controller: 'full',
        deck: 3,
        releaseDate: 1303171200,
        developer: 'Valve'
      })
      expect(extractMeta(228980, file.apps.get(228980)!).type).toBe('tool')
    })
  }

  it('only decodes the apps it is asked for', () => {
    const buf = buildAppInfo(29, [
      { appid: 1, data: portal },
      { appid: 2, data: portal }
    ])
    expect([...parseAppInfo(buf, new Set([2])).apps.keys()]).toEqual([2])
  })

  it('rejects files it does not understand', () => {
    expect(() => parseAppInfo(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/Unsupported/)
  })
})
