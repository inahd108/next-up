import type { OwnedGame } from '../data/cache'
import { getJson } from './http'

/** Steam Web API calls that need the person's own API key. */
const BASE = 'https://api.steampowered.com'

export interface PlayerSummary {
  steamId: string
  name: string
  avatarUrl: string | null
}

export async function getPlayerSummaries(key: string, steamIds: string[]): Promise<PlayerSummary[]> {
  if (steamIds.length === 0) return []
  const url = `${BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${steamIds.join(',')}`
  const data = await getJson<{
    response?: { players?: { steamid: string; personaname?: string; avatarfull?: string }[] }
  }>(url)
  return (data.response?.players ?? []).map((p) => ({
    steamId: p.steamid,
    name: p.personaname ?? '',
    avatarUrl: p.avatarfull ?? null
  }))
}

export async function getOwnedGames(key: string, steamId: string): Promise<{ private: boolean; games: OwnedGame[] }> {
  const url =
    `${BASE}/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${steamId}` +
    '&include_appinfo=1&include_played_free_games=1&skip_unvetted_apps=0'
  const data = await getJson<{
    response?: {
      games?: {
        appid: number
        name?: string
        playtime_forever?: number
        playtime_2weeks?: number
        rtime_last_played?: number
      }[]
    }
  }>(url, 30000)
  const games = data.response?.games
  // A private game list comes back as an empty response with no games array.
  if (!games) return { private: true, games: [] }
  return {
    private: false,
    games: games.map((g) => ({
      appid: g.appid,
      name: g.name ?? '',
      playtime: g.playtime_forever ?? 0,
      playtime2w: g.playtime_2weeks ?? 0,
      lastPlayed: g.rtime_last_played ?? 0
    }))
  }
}
