/**
 * Dieline tahlil qiluvchi — 3 ta strategiya:
 * 1. Oq bo'shliq segmentatsiya (standart)
 * 2. Fold-line aniqlash (lokal minimumlar) — bo'shliqsiz dielinlar uchun
 * 3. Nisbat tekshiruvi + yaxshi fallback
 */

export function autoDetectCrops(img) {
  const W = img.naturalWidth
  const H = img.naturalHeight

  // ── Downsample ──
  const MAX = 800
  const scale = Math.min(1, MAX / Math.max(W, H))
  const sw = Math.round(W * scale)
  const sh = Math.round(H * scale)

  const oc  = document.createElement('canvas')
  oc.width = sw; oc.height = sh
  const ctx = oc.getContext('2d')
  ctx.drawImage(img, 0, 0, sw, sh)
  const pix = ctx.getImageData(0, 0, sw, sh).data

  // Row/col zichlik (non-white piksel ulushi)
  const rowD = new Float32Array(sh)
  const colD = new Float32Array(sw)

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      const a = pix[i + 3]
      const r = pix[i], g = pix[i+1], b = pix[i+2]
      if (a < 10 || (r > 235 && g > 235 && b > 235)) continue
      rowD[y]++; colD[x]++
    }
  }
  for (let y = 0; y < sh; y++) rowD[y] /= sw
  for (let x = 0; x < sw; x++) colD[x] /= sh

  // Kontent chegaralari
  const TH = 0.006
  let top = 0, bot = sh-1, lft = 0, rgt = sw-1
  while (top < sh  && rowD[top] < TH) top++
  while (bot > top && rowD[bot] < TH) bot--
  while (lft < sw  && colD[lft] < TH) lft++
  while (rgt > lft && colD[rgt] < TH) rgt--

  if (rgt - lft < 20 || bot - top < 20) return null

  // ── Strategiya 1: Oq bo'shliq segmentatsiya ──
  const hSegs = findSegs(rowD, top, bot, TH)
  const vSegs = findSegs(colD, lft, rgt, TH)

  hSegs.sort((a,b) => a[0]-b[0])
  vSegs.sort((a,b) => a[0]-b[0])

  let result = null

  if (hSegs.length >= 2 && vSegs.length >= 2) {
    result = assignFaces(hSegs, vSegs, lft, rgt, top, bot, sw, sh)
  }

  // ── Strategiya 2: Fold-line aniqlash (Bo'shliqsiz dielinlar) ──
  if (!result || !isReasonable(result)) {
    const hFolds = findFoldLines(rowD, top, bot)
    const vFolds = findFoldLines(colD, lft, rgt)

    const hSegs2 = foldsToSegs(hFolds, top, bot)
    const vSegs2 = foldsToSegs(vFolds, lft, rgt)

    if (hSegs2.length >= 2 && vSegs2.length >= 2) {
      const r2 = assignFaces(hSegs2, vSegs2, lft, rgt, top, bot, sw, sh)
      if (isReasonable(r2)) result = r2
    }
  }

  // ── Strategiya 3: Kontent zonasini bo'lish ──
  if (!result || !isReasonable(result)) {
    result = splitByContentDensity(colD, rowD, lft, rgt, top, bot, sw, sh, pix)
  }

  return result
}

// ─────────────────────────────────────────────────
// Yuzlarni to'g'ri ajratish
// ─────────────────────────────────────────────────
function assignFaces(hSegs, vSegs, lft, rgt, top, bot, sw, sh) {
  const P = 0.004
  const crops = {}

  // Eng baland gorizontal segment → asosiy qator (front, left, right)
  const mainH  = hSegs.reduce((a,b) => len(b) > len(a) ? b : a)
  // Asosiy qatordagi eng keng vertikal segment → front
  const mainV  = vSegs.reduce((a,b) => len(b) > len(a) ? b : a)
  const mainVi = vSegs.indexOf(mainV)

  crops.front = pad({ x: mainV[0]/sw, y: mainH[0]/sh, w: len(mainV)/sw, h: len(mainH)/sh }, P)

  // Chap yon — mainV ning chap tomoni
  if (mainVi > 0) {
    const lv = vSegs[mainVi-1]
    crops.left = pad({ x: lv[0]/sw, y: mainH[0]/sh, w: len(lv)/sw, h: len(mainH)/sh }, P)
  } else {
    // Fallback: front ning chap qismidan
    crops.left = pad({ x: lft/sw, y: mainH[0]/sh, w: mainV[0]/sw - lft/sw, h: len(mainH)/sh }, P)
  }

  // O'ng yon
  const rightSegs = vSegs.filter((_,i) => i > mainVi)
  if (rightSegs.length) {
    const rv = rightSegs[0]
    crops.right = pad({ x: rv[0]/sw, y: mainH[0]/sh, w: len(rv)/sw, h: len(mainH)/sh }, P)
  } else {
    crops.right = pad({ x: (mainV[0]+len(mainV))/sw, y: mainH[0]/sh, w: (rgt-(mainV[0]+len(mainV)))/sw, h: len(mainH)/sh }, P)
  }

  // Yuqori
  const topBands = hSegs.filter(s => s[1] <= mainH[0]+5)
  if (topBands.length) {
    const tb = topBands.reduce((a,b) => Math.abs(b[1]-mainH[0]) < Math.abs(a[1]-mainH[0]) ? b : a)
    crops.top = pad({ x: mainV[0]/sw, y: tb[0]/sh, w: len(mainV)/sw, h: len(tb)/sh }, P)
  }

  // Orqa
  const sideBands = hSegs.filter(s => s !== mainH && s[0] < mainH[0])
  if (sideBands.length) {
    const bh = sideBands.reduce((a,b) => len(b) > len(a) ? b : a)
    crops.back = pad({ x: lft/sw, y: bh[0]/sh, w: (rgt-lft)/sw, h: len(bh)/sh }, P)
  } else if (rightSegs.length > 1) {
    // Chiziqli dieline: back → eng o'ng segment
    const bv = rightSegs[rightSegs.length-1]
    crops.back = pad({ x: bv[0]/sw, y: mainH[0]/sh, w: len(bv)/sw, h: len(mainH)/sh }, P)
  }

  // Pastki
  const belowBands = hSegs.filter(s => s[0] >= mainH[1]-5 && s !== mainH)
  if (belowBands.length) {
    const bb = belowBands.reduce((a,b) => len(b) > len(a) ? b : a)
    crops.bottom = pad({ x: lft/sw, y: bb[0]/sh, w: (rgt-lft)/sw, h: len(bb)/sh }, P)
  }

  return Object.keys(crops).length >= 3 ? crops : null
}

// ─────────────────────────────────────────────────
// Fold-line aniqlash: lokal minimumlar yordamida
// Panellar orasida oq bo'shliq bo'lmasa ham ishlaydi
// ─────────────────────────────────────────────────
function findFoldLines(arr, start, end) {
  const span = end - start
  if (span < 40) return []

  // Silliqlashtirish oynasi: span ning ~3%
  const win = Math.max(5, Math.round(span * 0.03))
  const smooth = new Float32Array(arr.length)

  for (let x = start; x <= end; x++) {
    let sum = 0, cnt = 0
    for (let dx = -win; dx <= win; dx++) {
      const xi = x + dx
      if (xi >= start && xi <= end) { sum += arr[xi]; cnt++ }
    }
    smooth[x] = cnt > 0 ? sum / cnt : 0
  }

  // Lokal minimumlarni top — qo'shni ±6 px dan kichik bo'lishi kerak
  const folds = []
  const MIN_GAP = Math.max(15, Math.round(span * 0.06))

  for (let x = start + win; x <= end - win; x++) {
    if (smooth[x] < 0.003) continue // juda past — hech narsa yo'q

    // Lokal minimum tekshiruvi
    let isMin = true
    for (let dx = -6; dx <= 6; dx++) {
      if (dx === 0) continue
      const xi = x + dx
      if (xi >= start && xi <= end && arr[xi] < arr[x]) { isMin = false; break }
    }

    // Qo'shnilaridan sezilarli darajada past (≤78%)
    if (isMin && arr[x] <= smooth[x] * 0.78) {
      if (!folds.length || x - folds[folds.length-1] >= MIN_GAP) {
        folds.push(x)
      }
    }
  }

  return folds
}

// Fold line pozitsiyalaridan segment massivi yaratish
function foldsToSegs(folds, start, end) {
  const points = [start, ...folds, end]
  const segs = []
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i], e2 = points[i+1]
    if (e2 - s > 8) segs.push([s, e2])
  }
  return segs
}

// ─────────────────────────────────────────────────
// Strategiya 3: Kontent zichligiga qarab bo'lish
// Fold line topilmasa, eng zич (design bor) hududni front deb olish
// ─────────────────────────────────────────────────
function splitByContentDensity(colD, rowD, lft, rgt, top, bot, sw, sh, pix) {
  const P = 0.004
  const cw = rgt - lft
  const ch = bot - top

  // Asosiy qator chegaralari (rowD bo'yicha eng zich zona)
  let bestRowStart = top, bestRowVal = 0
  const rowWin = Math.round(ch * 0.25)
  for (let y = top; y <= bot - rowWin; y++) {
    let sum = 0
    for (let dy = 0; dy < rowWin; dy++) sum += rowD[y+dy]
    if (sum > bestRowVal) { bestRowVal = sum; bestRowStart = y }
  }
  const mainRowH = [bestRowStart, Math.min(bot, bestRowStart + rowWin)]

  // Asosiy qatordagi vertikal zichlik profili
  const mainColD = new Float32Array(sw)
  for (let x = lft; x <= rgt; x++) {
    let sum = 0
    for (let y = mainRowH[0]; y <= mainRowH[1]; y++) sum += rowD[y] > 0 ? 1 : 0
    // Pixel sathi zichlik
    for (let y = mainRowH[0]; y <= mainRowH[1]; y++) {
      const i = (y * sw + x) * 4
      const a = pix[i+3], r = pix[i], g = pix[i+1], b = pix[i+2]
      if (a > 10 && !(r > 235 && g > 235 && b > 235)) mainColD[x]++
    }
    mainColD[x] /= (mainRowH[1] - mainRowH[0] + 1)
  }

  // Eng zich vertikal bo'lakni front deb topish (sliding window)
  const frontW = Math.round(cw * 0.35) // front taxminan 35% kenglik
  let bestX = lft, bestVal = 0
  for (let x = lft; x <= rgt - frontW; x++) {
    let sum = 0
    for (let dx = 0; dx < frontW; dx++) sum += mainColD[x+dx]
    if (sum > bestVal) { bestVal = sum; bestX = x }
  }

  const crops = {}
  const mH = mainRowH[1] - mainRowH[0]
  const mW = frontW

  crops.front  = pad({ x: bestX/sw,       y: mainRowH[0]/sh, w: frontW/sw,                 h: mH/sh }, P)
  crops.left   = pad({ x: Math.max(lft,bestX - Math.round(cw*0.15))/sw, y: mainRowH[0]/sh,
                       w: Math.round(cw*0.14)/sw, h: mH/sh }, P)
  crops.right  = pad({ x: (bestX+frontW)/sw, y: mainRowH[0]/sh, w: Math.round(cw*0.14)/sw, h: mH/sh }, P)
  crops.back   = pad({ x: (bestX+frontW+Math.round(cw*0.15))/sw, y: mainRowH[0]/sh,
                       w: Math.round(cw*0.33)/sw, h: mH/sh }, P)
  crops.top    = pad({ x: bestX/sw, y: top/sh,            w: frontW/sw, h: Math.max(0.04, (mainRowH[0]-top)/sh) }, P)
  crops.bottom = pad({ x: bestX/sw, y: mainRowH[1]/sh,    w: frontW/sw, h: Math.max(0.04, (bot-mainRowH[1])/sh) }, P)

  return crops
}

// ─────────────────────────────────────────────────
// Nisbat tekshiruvi — jismoniy jihatdan mantiqli bo'lish kerak
// D/W 0.08 dan 1.2 gacha bo'lishi kerak
// ─────────────────────────────────────────────────
function isReasonable(crops) {
  if (!crops || !crops.front || !crops.left) return false
  const ratio = crops.left.w / crops.front.w
  return ratio > 0.06 && ratio < 1.5 && crops.front.w > 0.05 && crops.front.h > 0.05
}

// ─────────────────────────────────────────────────
// Yordamchi funksiyalar
// ─────────────────────────────────────────────────
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
  x: Math.max(0, Math.min(0.98, x + p)),
  y: Math.max(0, Math.min(0.98, y + p)),
  w: Math.max(0.02, Math.min(1, w - p*2)),
  h: Math.max(0.02, Math.min(1, h - p*2)),
})
