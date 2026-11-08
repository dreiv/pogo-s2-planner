// Generates PWA icons (PNG) without dependencies.
// Usage: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'icons')

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idata = deflateSync(raw)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idata),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function makeIcon(size, { bg, fg, grid = true, maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const pad = maskable ? size * 0.2 : size * 0.12

  for (let i = 0; i < size * size; i++) {
    px[i * 4] = bg[0]
    px[i * 4 + 1] = bg[1]
    px[i * 4 + 2] = bg[2]
    px[i * 4 + 3] = 255
  }

  const r = size * 0.18
  const x0 = pad
  const y0 = pad
  const x1 = size - pad
  const y1 = size - pad

  const inRoundedRect = (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : 0
    const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : 0
    if (cx === 0 && cy === 0) return true
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= r * r
  }

  const cells = 3
  const gap = size * 0.04
  const cellW = (x1 - x0 - gap * (cells - 1)) / cells

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x, y)) continue
      const i = y * size + x
      const gx = Math.floor((x - x0) / (cellW + gap))
      const gy = Math.floor((y - y0) / (cellW + gap))
      const inCell =
        gx >= 0 &&
        gy >= 0 &&
        gx < cells &&
        gy < cells &&
        (x - x0) % (cellW + gap) < cellW &&
        (y - y0) % (cellW + gap) < cellW

      if (grid && inCell) {
        const isCenter = gx === 1 && gy === 1
        px[i * 4] = isCenter ? fg[0] : fg[0]
        px[i * 4 + 1] = isCenter ? fg[1] : fg[1]
        px[i * 4 + 2] = isCenter ? fg[2] : fg[2]
        px[i * 4 + 3] = isCenter ? 255 : 160
      }
    }
  }

  return encodePNG(size, size, px)
}

mkdirSync(OUT_DIR, { recursive: true })

const bg = [17, 24, 39]
const fg = [59, 130, 246]

writeFileSync(join(OUT_DIR, 'icon-192.png'), makeIcon(192, { bg, fg }))
writeFileSync(join(OUT_DIR, 'icon-512.png'), makeIcon(512, { bg, fg }))
writeFileSync(
  join(OUT_DIR, 'maskable-512.png'),
  makeIcon(512, { bg, fg, maskable: true })
)

console.log('Icons written to', OUT_DIR)
