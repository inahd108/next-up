import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, normalize } from 'node:path'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function queryRegistry(key: string, value: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('reg', ['query', key, '/v', value], { windowsHide: true, timeout: 4000 }, (error, stdout) => {
      if (error) return resolve(null)
      const match = new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`, 'i').exec(stdout)
      resolve(match ? match[1].trim() : null)
    })
  })
}

/** True when the folder looks like a Steam install. */
export async function isSteamFolder(path: string): Promise<boolean> {
  return (await exists(join(path, 'steamapps'))) || (await exists(join(path, 'config', 'loginusers.vdf')))
}

/** Finds the Steam install folder, preferring a folder the person chose themselves. */
export async function locateSteam(override: string | null): Promise<string | null> {
  const candidates: string[] = []
  if (override) candidates.push(override)

  if (process.platform === 'win32') {
    const user = await queryRegistry('HKCU\\Software\\Valve\\Steam', 'SteamPath')
    if (user) candidates.push(user)
    const machine = await queryRegistry('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath')
    if (machine) candidates.push(machine)
    candidates.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam')
  } else if (process.platform === 'darwin') {
    candidates.push(join(homedir(), 'Library', 'Application Support', 'Steam'))
  } else {
    candidates.push(
      join(homedir(), '.steam', 'steam'),
      join(homedir(), '.local', 'share', 'Steam'),
      join(homedir(), '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam')
    )
  }

  for (const candidate of candidates) {
    const path = normalize(candidate)
    if (await isSteamFolder(path)) return path
  }
  return null
}
