/**
 * Analyse a dieline image and return detected crop regions.
 * Uses row/column density profiles to find non-white content bands.
 */
export function autoDetectCrops(img) {
  const W = img.naturalWidth
  const H = img.naturalHeight

  const oc = document.createElement('canvas')
  oc.width = W; oc.height = H
  const ctx = oc.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const pix = ctx.getImageData(0, 0, W, H).data

  // Row / col content density (fraction of non-white pixels)
  const rowD = new Float32Array(H)
  const colD = new Float32Array(W)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const a = pix[i + 3]
      const r = pix[i], g = pix[i+1], b = pix[i+2]
      if (a < 10 || (r > 238 && g > 238 && b > 238)) continue
      rowD[y]++; colD[x]++
    }
  }
  for (let y = 0; y < H; y++) rowD[y] /= W
  for (let x = 0; x < W; x++) colD[x] /= H

  // Tight bounding box of all content
  const TH = 0.008
  let top = 0, bot = H - 1, lft = 0, rgt = W - 1
  while (top < H  && rowD[top] < TH) top++
  while (bot > top && rowD[bot] < TH) bot--
  while (lft < W  && colD[lft] < TH) lft++
  while (rgt > lft && colD[rgt] < TH) rgt--

  const hSegs = findSegs(rowD, top, bot, TH)
  const vSegs = findSegs(colD, lft, rgt, TH)

  if (hSegs.length < 2 || vSegs.length < 2) return null

  hSegs.sort((a, b) => a[0] - b[0])
  vSegs.sort((a, b) => a[0] - b[0])

  // Tallest h-segment → main row (contains front face)
  const mainH = hSegs.reduce((a, b) => len(b) > len(a) ? b : a)
  // Widest v-segment → front face column
  const mainV = vSegs.reduce((a, b) => len(b) > len(a) ? b : a)
  const mainVi = vSegs.indexOf(mainV)

  const crops = {}
  const P = 0.004 // small padding

  // FRONT
  crops.front = pad({ x: mainV[0]/W, y: mainH[0]/H, w: len(mainV)/W, h: len(mainH)/H }, P)

  // LEFT side = v-segment directly left of front, same h row
  if (mainVi > 0) {
    const lv = vSegs[mainVi - 1]
    crops.left = pad({ x: lv[0]/W, y: mainH[0]/H, w: len(lv)/W, h: len(mainH)/H }, P)
  }

  // TOP = narrowest h-segment above main row, same columns as front
  const topBands = hSegs.filter(s => s[1] <= mainH[0] + 5)
  if (topBands.length) {
    const tb = topBands.reduce((a, b) => len(b) < len(a) ? b : a)
    crops.top = pad({ x: mainV[0]/W, y: tb[0]/H, w: len(mainV)/W, h: len(tb)/H }, P)
  }

  // BACK = largest h-segment above main row (usually largest remaining)
  const aboveBands = hSegs.filter(s => s !== mainH && s[0] < mainH[0])
  if (aboveBands.length) {
    const bh = aboveBands.reduce((a, b) => len(b) > len(a) ? b : a)
    // Back spans widest content column
    const bv = vSegs.reduce((a, b) => len(b) > len(a) ? b : a)
    crops.back = pad({ x: lft/W, y: bh[0]/H, w: (rgt - lft)/W, h: len(bh)/H }, P)
  }

  // RIGHT side = first v-segment right of front (may span full content height)
  const rightSegs = vSegs.filter((_, i) => i > mainVi)
  if (rightSegs.length) {
    const rv = rightSegs[0]
    crops.right = pad({ x: rv[0]/W, y: top/H, w: len(rv)/W, h: (bot - top)/H }, P)
  }

  // BOTTOM = largest h-segment below main row
  const belowBands = hSegs.filter(s => s[0] >= mainH[1] - 5 && s !== mainH)
  if (belowBands.length) {
    const bb = belowBands.reduce((a, b) => len(b) > len(a) ? b : a)
    crops.bottom = pad({ x: lft/W, y: bb[0]/H, w: (rgt - lft)/W, h: len(bb)/H }, P)
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
