/**
 * Read-only checks against the Steam install on this PC, if there is one.
 * They make sure the readers cope with real files; they never write anything.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readAccounts } from '../src/main/steam/accounts'
import { extractMeta, parseAppInfo } from '../src/main/steam/appinfo'
import { readInstalledApps } from '../src/main/steam/installed'
import { locateSteam } from '../src/main/steam/locate'

const steamPath = await locateSteam(null)

describe.runIf(steamPath)('Steam install on this PC', () => {
  it('reads accounts, installed games and the app info cache', async () => {
    const accounts = await readAccounts(steamPath!)
    const installed = await readInstalledApps(steamPath!)
    const appinfo = parseAppInfo(await readFile(join(steamPath!, 'appcache', 'appinfo.vdf')))

    const metas = [...appinfo.apps].map(([id, info]) => extractMeta(id, info))
    const types = new Map<string, number>()
    for (const meta of metas) types.set(meta.type ?? '?', (types.get(meta.type ?? '?') ?? 0) + 1)

    const localApps = new Set(accounts.flatMap((a) => [...a.apps.keys()]))
    const covered = [...localApps].filter((id) => appinfo.apps.has(id)).length

    console.log(
      JSON.stringify({
        accounts: accounts.length,
        appsPerAccount: accounts.map((a) => a.apps.size),
        installed: installed.size,
        appinfoVersion: appinfo.version,
        appinfoEntries: appinfo.apps.size,
        appinfoTypes: Object.fromEntries(types),
        withTags: metas.filter((m) => m.tagIds.length > 0).length,
        localAppsCoveredByAppinfo: `${covered}/${localApps.size}`
      })
    )

    expect(accounts.length).toBeGreaterThan(0)
    expect(appinfo.apps.size).toBeGreaterThan(0)
  })
})
