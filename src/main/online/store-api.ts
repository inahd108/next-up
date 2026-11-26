import type { StoreDetails } from '../data/cache'
import { getJson, sleep } from './http'

/**
 * Steam's public store browse API. No API key needed. Returns tags, categories,
 * reviews, Steam Deck status and artwork for up to a few hundred apps per call.
 */
const ENDPOINT = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/'
const ASSET_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/'
const BATCH = 50

interface RawItem {
  id?: number
  appid?: number
  success?: number
  name?: string
  type?: number
  tagids?: number[]
  tags?: { tagid: number; weight: number }[]
  categories?: {
    supported_player_categoryids?: number[]
    feature_categoryids?: number[]
    controller_categoryids?: number[]
  }
  reviews?: { summary_filtered?: { review_count?: number; percent_positive?: number; review_score_label?: string } }
  basic_info?: { short_description?: string; developers?: { name?: string }[] }
  release?: { steam_release_date?: number; original_release_date?: number }
  platforms?: { steam_deck_compat_category?: number }
  assets?: {
    asset_url_format?: string
    header?: string
    library_capsule?: string
    library_hero?: string
  }
}

interface RawResponse {
  response?: { store_items?: RawItem[] }
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' }

function cleanText(text: string | undefined): string | null {
  if (!text) return null
  const plain = text
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|quot|#39|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .trim()
  return plain || null
}

function missing(appid: number): StoreDetails {
  return {
    appid,
    missing: true,
    name: null,
    type: null,
    tagIds: [],
    categoryIds: [],
    reviewPercent: null,
    reviewCount: null,
    reviewLabel: null,
    description: null,
    developer: null,
    releaseDate: null,
    deck: 0,
    assets: {},
    fetchedAt: Date.now()
  }
}

export function normaliseItem(item: RawItem): StoreDetails | null {
  const appid = item.appid ?? item.id
  if (!appid) return null
  if (item.success !== 1) return missing(appid)

  const tagIds = item.tags?.length
    ? [...item.tags].sort((a, b) => b.weight - a.weight).map((t) => t.tagid)
    : (item.tagids ?? [])
  const cats = item.categories ?? {}
  const reviews = item.reviews?.summary_filtered
  const format = item.assets?.asset_url_format
  const asset = (file: string | undefined): string | undefined =>
    format && file ? ASSET_BASE + format.replace('${FILENAME}', file) : undefined
  const deck = item.platforms?.steam_deck_compat_category ?? 0

  return {
    appid,
    missing: false,
    name: item.name ?? null,
    type: typeof item.type === 'number' ? item.type : null,
    tagIds,
    categoryIds: [
      ...(cats.supported_player_categoryids ?? []),
      ...(cats.feature_categoryids ?? []),
      ...(cats.controller_categoryids ?? [])
    ],
    reviewPercent: reviews?.review_count ? (reviews.percent_positive ?? null) : null,
    reviewCount: reviews?.review_count ?? null,
    reviewLabel: reviews?.review_count ? (reviews.review_score_label ?? null) : null,
    description: cleanText(item.basic_info?.short_description),
    developer: item.basic_info?.developers?.[0]?.name ?? null,
    releaseDate: item.release?.steam_release_date ?? item.release?.original_release_date ?? null,
    deck: deck >= 0 && deck <= 3 ? (deck as 0 | 1 | 2 | 3) : 0,
    assets: {
      header: asset(item.assets?.header),
      cover: asset(item.assets?.library_capsule),
      hero: asset(item.assets?.library_hero)
    },
    fetchedAt: Date.now()
  }
}

/** Downloads store details in batches, reporting each batch as it lands. */
export async function fetchStoreDetails(
  appids: number[],
  onBatch: (details: StoreDetails[], done: number) => void
): Promise<void> {
  for (let start = 0; start < appids.length; start += BATCH) {
    const ids = appids.slice(start, start + BATCH)
    const input = {
      ids: ids.map((appid) => ({ appid })),
      context: { language: 'english', country_code: 'US', steam_realm: 1 },
      data_request: {
        include_tag_count: 20,
        include_basic_info: true,
        include_reviews: true,
        include_platforms: true,
        include_assets: true,
        include_release: true
      }
    }
    const url = `${ENDPOINT}?input_json=${encodeURIComponent(JSON.stringify(input))}`
    const data = await getJson<RawResponse>(url, 20000)

    const byId = new Map<number, StoreDetails>()
    for (const item of data.response?.store_items ?? []) {
      const details = normaliseItem(item)
      if (details) byId.set(details.appid, details)
    }
    onBatch(
      ids.map((id) => byId.get(id) ?? missing(id)),
      Math.min(appids.length, start + BATCH)
    )
    if (start + BATCH < appids.length) await sleep(350)
  }
}
