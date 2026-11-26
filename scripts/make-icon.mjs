// Draws the app icon (a rounded square with a "next" symbol) and saves it as build/icon.png.
// No dependencies: shapes are drawn with signed distance functions and encoded as PNG by hand.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const S = 512
const px = Buffer.alloc(S * S * 4)

const top = [146, 132, 250]
const bottom = [88, 66, 230]

function roundRect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - hw + r
  const dy = Math.abs(y - cy) - hh + r
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - r
}

function triangle(x, y, p0, p1, p2) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1]
  const clamp = (v) => Math.max(0, Math.min(1, v))
  const e = [sub(p1, p0), sub(p2, p1), sub(p0, p2)]
  const v = [sub([x, y], p0), sub([x, y], p1), sub([x, y], p2)]
  const q = v.map((vi, i) => {
    const t = clamp(dot(vi, e[i]) / dot(e[i], e[i]))
    return [vi[0] - e[i][0] * t, vi[1] - e[i][1] * t]
  })
  const s = Math.sign(e[0][0] * e[2][1] - e[0][1] * e[2][0])
  const d = q.map((qi, i) => [dot(qi, qi), s * (v[i][0] * e[i][1] - v[i][1] * e[i][0])])
  const dist = Math.min(...d.map((p) => p[0]))
  const side = Math.min(...d.map((p) => p[1]))
  return -Math.sqrt(dist) * Math.sign(side)
}

const cover = (d) => Math.max(0, Math.min(1, 0.5 - d))

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    const bg = cover(roundRect(x + 0.5, y + 0.5, 256, 256, 232, 232, 112))
    if (bg <= 0) continue
    const t = (x + y) / (2 * S)
    const color = top.map((c, k) => Math.round(c + (bottom[k] - c) * t))

    // Glyph: a play triangle followed by a bar, like a "next" button.
    const tri = triangle(x + 0.5, y + 0.5, [168, 166], [168, 346], [306, 256]) - 14
    const bar = roundRect(x + 0.5, y + 0.5, 343, 256, 21, 100, 18)
    const glyph = cover(Math.min(tri, bar))

    for (let k = 0; k < 3; k++) px[i + k] = Math.round(color[k] + (255 - color[k]) * glyph)
    px[i + 3] = Math.round(255 * bg)
  }
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr.set([8, 6, 0, 0, 0], 8)

const raw = Buffer.alloc((S * 4 + 1) * S)
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

mkdirSync('build', { recursive: true })
writeFileSync('build/icon.png', png)
console.log(`build/icon.png written (${png.length} bytes)`)
