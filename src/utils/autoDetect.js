/**
 * Analyse a dieline image and return detected crop regions.
 * Downsamples to max 800px before pixel analysis — prevents UI freeze on 4K images.
 */
export function autoDetectCrops(img) {
  const W = img.naturalWidth
  const H = img.naturalHeight

  // ── Downsample to max 800px — reduces work by up to 25x ──
  const MAX = 800
  const scale = Math.min(1, MAX / Math.max(W, H))
  const sw = Math.round(W * scale)
  const sh = Math.round(H * scale)

  const oc = document.createElement('canvas')
  oc.width = sw; oc.height = sh
  const ctx = oc.getContext('2d')
  ctx.drawImage(img, 0, 0, sw, sh)
  const pix = ctx.getImageData(0, 0, sw, sh).data

  // Row / col content density (fraction of non-white pixels)
  const rowD = new Float32Array(sh)
  const colD = new Float32Array(sw)

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      const a = pix[i + 3]
      const r = pix[i], g = pix[i+1], b = pix[i+2]
      if (a < 10 || (r > 238 && g > 238 && b > 238)) continue
      rowD[y]++; colD[x]++
    }
  }
  for (let y = 0; y < sh; y++) rowD[y] /= sw
  for (let x = 0; x < sw; x++) colD[x] /= sh

  // Tight bounding box of all content
  const TH = 0.008
  let top = 0, bot = sh - 1, lft = 0, rgt = sw - 1
  while (top < sh  && rowD[top] < TH) top++
  while (bot > top && rowD[bot] < TH) bot--
  while (lft < sw  && colD[lft] < TH) lft++
  while (rgt > lft && colD[rgt] < TH) rgt--

  const hSegs = findSegs(rowD, top, bot, TH)
  const vSegs = findSegs(colD, lft, rgt, TH)

  if (hSegs.length < 2 || vSegs.length < 2) return null

  hSegs.sort((a, b) => a[0] - b[0])
  vSegs.sort((a, b) => a[0] - b[0])

  // Tallest h-segment → main row (contains front face)
  const mainH  = hSegs.reduce((a, b) => len(b) > len(a) ? b : a)
  // Widest v-segment → front face column
  const mainV  = vSegs.reduce((a, b) => len(b) > len(a) ? b : a)
  const mainVi = vSegs.indexOf(mainV)

  const crops = {}
  const P = 0.004 // small padding

  // FRONT — scaled back to original image coordinates
  crops.front = pad({
    x: mainV[0]/sw, y: mainH[0]/sh, w: len(mainV)/sw, h: len(mainH)/sh,
  }, P)

  // LEFT side = v-segment directly left of front, same h row
  if (mainVi > 0) {
    const lv = vSegs[mainVi - 1]
    crops.left = pad({ x: lv[0]/sw, y: mainH[0]/sh, w: len(lv)/sw, h: len(mainH)/sh }, P)
  }

  // TOP = narrowest h-segment above main row, same columns as front
  const topBands = hSegs.filter(s => s[1] <= mainH[0] + 5)
  if (topBands.length) {
    const tb = topBands.reduce((a, b) => len(b) < len(a) ? b : a)
    crops.top = pad({ x: mainV[0]/sw, y: tb[0]/sh, w: len(mainV)/sw, h: len(tb)/sh }, P)
  }

  // BACK = largest h-segment above main row
  const aboveBands = hSegs.filter(s => s !== mainH && s[0] < mainH[0])
  if (aboveBands.length) {
    const bh = aboveBands.reduce((a, b) => len(b) > len(a) ? b : a)
    crops.back = pad({ x: lft/sw, y: bh[0]/sh, w: (rgt - lft)/sw, h: len(bh)/sh }, P)
  }

  // RIGHT side = first v-segment right of front
  const rightSegs = vSegs.filter((_, i) => i > mainVi)
  if (rightSegs.length) {
    const rv = rightSegs[0]
    crops.right = pad({ x: rv[0]/sw, y: top/sh, w: len(rv)/sw, h: (bot - top)/sh }, P)
  }

  // BOTTOM = largest h-segment below main row
  const belowBands = hSegs.filter(s => s[0] >= mainH[1] - 5 && s !== mainH)
  if (belowBands.length) {
    const bb = belowBands.reduce((a, b) => len(b) > len(a) ? b : a)
    crops.bottom = pad({ x: lft/sw, y: bb[0]/sh, w: (rgt - lft)/sw, h: len(bb)/sh }, P)
  }

  return crops
}

function findSegs(arr, start, end, thresh) {
  const segs = []
  let inSeg = false, ss = 0
  for (let i = start; i <= end; i++) {
    if (!inSeg && arr[i] > thresh) { inSeg = true; ss = i }
    else if (inSeg && arr[i] <= thresh) {
      if (i - ss > 3) segs.push([ss, i])
      inSeg = false
    }
  }
  if (inSeg && end - ss > 3) segs.push([ss, end])
  return segs
}

const len = ([a, b]) => b - a
const pad = ({ x, y, w, h }, p) => ({
  x: Math.max(0, x + p),
  y: Math.max(0, y + p),
  w: Math.max(0.02, w - p * 2),
  h: Math.max(0.02, h - p * 2),
})
