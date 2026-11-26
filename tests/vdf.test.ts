import { describe, expect, it } from 'vitest'
import { parseVdf, vget, vnum } from '../src/main/steam/vdf'
import { parseLocalConfigApps, toAccountId, toSteamId64 } from '../src/main/steam/accounts'
import { parseAppManifest } from '../src/main/steam/installed'

describe('parseVdf', () => {
  it('reads nested objects, escapes, comments and conditionals', () => {
    const text = `
      // a comment
      "libraryfolders"
      {
        "0"
        {
          "path"    "C:\\\\Program Files (x86)\\\\Steam"
          "label"   ""
          "quote"   "say \\"hi\\""
          "flag"    "1"  [$WIN32]
          unquoted  value
        }
      }`
    const root = parseVdf(text)
    expect(vget(root, 'libraryfolders', '0', 'path')).toBe('C:\\Program Files (x86)\\Steam')
    expect(vget(root, 'libraryfolders', '0', 'label')).toBe('')
    expect(vget(root, 'libraryfolders', '0', 'quote')).toBe('say "hi"')
    expect(vget(root, 'libraryfolders', '0', 'flag')).toBe('1')
    expect(vget(root, 'libraryfolders', '0', 'unquoted')).toBe('value')
  })

  it('looks keys up without caring about case', () => {
    const root = parseVdf('"A" { "Software" { "valve" { "x" "5" } } }')
    expect(vnum(vget(root, 'a', 'software', 'Valve', 'X'))).toBe(5)
  })

  it('merges repeated blocks instead of dropping one', () => {
    const root = parseVdf('"r" { "apps" { "1" "a" } "apps" { "2" "b" } }')
    expect(vget(root, 'r', 'apps')).toEqual({ '1': 'a', '2': 'b' })
  })

  it('survives truncated files', () => {
    expect(() => parseVdf('"a" { "b" { "c" "d"')).not.toThrow()
  })
})

describe('Steam config files', () => {
  it('reads playtime from localconfig.vdf', () => {
    const root = parseVdf(`
      "UserLocalConfigStore"
      {
        "Software" { "Valve" { "Steam" { "apps" {
          "620" { "LastPlayed" "1700000000" "Playtime" "754" "Playtime2wks" "30" }
          "440" { "cloud" { "last_sync_state" "synchronized" } }
        } } } }
      }`)
    const apps = parseLocalConfigApps(root)
    expect(apps.get(620)).toEqual({ playtime: 754, playtime2w: 30, lastPlayed: 1700000000 })
    expect(apps.get(440)).toEqual({ playtime: 0, playtime2w: 0, lastPlayed: 0 })
  })

  it('reads app manifests', () => {
    const app = parseAppManifest(`
      "AppState"
      {
        "appid"  "620"
        "name"   "Portal 2"
        "StateFlags" "4"
        "SizeOnDisk" "12884901888"
        "LastOwner" "76561197960287930"
        "LastPlayed" "1700000000"
      }`)
    expect(app).toEqual({
      appid: 620,
      name: 'Portal 2',
      installed: true,
      sizeOnDisk: 12884901888,
      lastOwner: '76561197960287930',
      lastPlayed: 1700000000
    })
  })

  it('treats a manifest that is still downloading as not installed', () => {
    const app = parseAppManifest('"AppState" { "appid" "10" "StateFlags" "1026" }')
    expect(app?.installed).toBe(false)
  })

  it('converts between account ids and SteamID64', () => {
    expect(toSteamId64(22202)).toBe('76561197960287930')
    expect(toAccountId('76561197960287930')).toBe(22202)
  })
})
