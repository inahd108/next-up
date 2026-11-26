/**
 * Reader for Valve's text KeyValues format (.vdf / .acf files).
 * Handles quoted and unquoted tokens, escapes, // comments and [$PLATFORM] conditionals.
 */
export type VdfValue = string | VdfObject
export interface VdfObject {
  [key: string]: VdfValue
}

const OPEN = 1
const CLOSE = 2
const STR = 3
const END = 0

export function parseVdf(text: string): VdfObject {
  const n = text.length
  let i = 0
  let tokenValue = ''

  const isSpace = (c: number): boolean => c === 32 || c === 9 || c === 10 || c === 13 || c === 0xfeff

  function skip(): void {
    while (i < n) {
      const c = text.charCodeAt(i)
      if (isSpace(c)) {
        i++
      } else if (c === 47 && text.charCodeAt(i + 1) === 47) {
        const newline = text.indexOf('\n', i)
        i = newline === -1 ? n : newline + 1
      } else {
        return
      }
    }
  }

  function next(): number {
    skip()
    if (i >= n) return END
    const c = text.charCodeAt(i)
    if (c === 123) {
      i++
      return OPEN
    }
    if (c === 125) {
      i++
      return CLOSE
    }
    if (c === 34) {
      i++
      let out = ''
      let segment = i
      while (i < n) {
        const ch = text.charCodeAt(i)
        if (ch === 92 && i + 1 < n) {
          out += text.slice(segment, i)
          const escaped = text[i + 1]
          out += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped
          i += 2
          segment = i
          continue
        }
        if (ch === 34) break
        i++
      }
      out += text.slice(segment, i)
      i++
      tokenValue = out
      return STR
    }
    const start = i
    while (i < n) {
      const ch = text.charCodeAt(i)
      if (isSpace(ch) || ch === 123 || ch === 125 || ch === 34) break
      i++
    }
    tokenValue = text.slice(start, i)
    return STR
  }

  const isConditional = (s: string): boolean => s.length > 2 && s[0] === '[' && s[s.length - 1] === ']'

  function parseBody(target: VdfObject): void {
    for (;;) {
      let token = next()
      if (token === END || token === CLOSE) return
      if (token === OPEN) {
        parseBody({})
        continue
      }
      const key = tokenValue
      token = next()
      if (token === STR && isConditional(tokenValue)) token = next()
      if (token === OPEN) {
        const child: VdfObject = {}
        parseBody(child)
        const existing = target[key]
        if (existing && typeof existing === 'object') Object.assign(existing, child)
        else target[key] = child
      } else if (token === STR) {
        target[key] = tokenValue
        const saved = i
        const after = next()
        if (!(after === STR && isConditional(tokenValue))) i = saved
      } else {
        return
      }
    }
  }

  const root: VdfObject = {}
  parseBody(root)
  return root
}

/** Case-insensitive path lookup, since Steam is inconsistent about key casing. */
export function vget(value: VdfValue | undefined, ...path: string[]): VdfValue | undefined {
  let current = value
  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined
    if (part in current) {
      current = current[part]
      continue
    }
    const lower = part.toLowerCase()
    const match = Object.keys(current).find((k) => k.toLowerCase() === lower)
    current = match === undefined ? undefined : current[match]
  }
  return current
}

export function vobj(value: VdfValue | undefined): VdfObject | undefined {
  return value && typeof value === 'object' ? value : undefined
}

export function vstr(value: VdfValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function vnum(value: VdfValue | undefined): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}
