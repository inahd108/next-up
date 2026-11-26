import { net } from 'electron'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

const HEADERS = { Accept: 'application/json', 'User-Agent': 'NextUp/1.0 (desktop)' }

export async function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const response = await net.fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new HttpError(response.status, `Steam returned ${response.status}`)
  return (await response.json()) as T
}

export async function getBinary(url: string, timeoutMs = 15000): Promise<{ data: Buffer; type: string } | null> {
  try {
    const response = await net.fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return null
    const type = response.headers.get('content-type') ?? 'application/octet-stream'
    if (!type.startsWith('image/')) return null
    return { data: Buffer.from(await response.arrayBuffer()), type }
  } catch {
    return null
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
