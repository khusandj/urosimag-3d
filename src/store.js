import { create } from 'zustand'

export const FACE_META = [
  { id: 'front',  label: 'Old (UROSIMAG)', color: 'rgba(60,200,90,.35)',  stroke: '#3dc85a', threeIdx: 4 },
  { id: 'back',   label: 'Orqa (Tarkib)',  color: 'rgba(60,110,220,.35)', stroke: '#4070e8', threeIdx: 5 },
  { id: 'right',  label: "O'ng yon",       color: 'rgba(220,70,70,.35)',  stroke: '#e04646', threeIdx: 0 },
  { id: 'left',   label: 'Chap yon',       color: 'rgba(220,160,30,.35)', stroke: '#dca020', threeIdx: 1 },
  { id: 'top',    label: 'Yuqori',         color: 'rgba(160,70,220,.35)', stroke: '#a046dc', threeIdx: 2 },
  { id: 'bottom', label: 'Pastki',         color: 'rgba(40,200,200,.35)', stroke: '#28c8c8', threeIdx: 3 },
]

export const DEFAULT_CROPS = {
  front:  { x: .22, y: .40, w: .55, h: .30  },
  back:   { x: .01, y: .03, w: .48, h: .36  },
  right:  { x: .76, y: .03, w: .22, h: .64  },
  left:   { x: .01, y: .40, w: .21, h: .30  },
  top:    { x: .22, y: .03, w: .55, h: .065 },
  bottom: { x: .01, y: .72, w: .55, h: .26  },
}

export const BG_PRESETS = [
  { id: 'dark',   label: 'Qora',    style: '#07050a',   threeColor: 0x07050a },
  { id: 'light',  label: 'Och',     style: 'linear-gradient(135deg,#d8d0c0,#f0ece0)', threeColor: 0xe0d8c8 },
  { id: 'white',  label: 'Oq',      style: '#ffffff',   threeColor: 0xffffff },
  { id: 'transp', label: 'Shaffof', style: 'repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 0 0/12px 12px', threeColor: null },
  { id: 'gold',   label: 'Oltin',   style: 'linear-gradient(135deg,#3a2800,#1a1000)', threeColor: 0x1a1000 },
  { id: 'blue',   label: "Ko'k",    style: 'linear-gradient(135deg,#0a0e1a,#101828)', threeColor: 0x0a0e1a },
  { id: 'grad',   label: 'Gradient',style: 'radial-gradient(ellipse at center,#2a2030,#080608)', threeColor: 0x180d20 },
  { id: 'custom', label: 'Rang',    style: '#c83050',   threeColor: null },
]

// ─────────────────────────────────────────────────────────────────────────────
// Crop px-yuzasini HTMLCanvasElement ga kesib olish (sinxron)
// ─────────────────────────────────────────────────────────────────────────────
export function cropToCanvas(img, f) {
  const sx = f.x * img.naturalWidth
  const sy = f.y * img.naturalHeight
  const sw = f.w * img.naturalWidth
  const sh = f.h * img.naturalHeight
  if (sw < 2 || sh < 2) return null
  const c = document.createElement('canvas')
  c.width  = Math.round(sw)
  c.height = Math.round(sh)
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c
}

// ─────────────────────────────────────────────────────────────────────────────
// Karobka o'lchamlari FAQAT crop nisbatlaridan hisoblanadi
//   boxScale = 1.0 → balandlik 100 mm
//   W, D → front + left crop piksel nisbatidan
// ─────────────────────────────────────────────────────────────────────────────
export function computeBoxDims(srcImg, crops, boxScale) {
  if (!srcImg) return { w: 1.8 * boxScale, h: 1.0 * boxScale, d: 0.7 * boxScale, wMM: 180, hMM: 100, dMM: 70 }
  const fw = crops.front.w * srcImg.naturalWidth
  const fh = crops.front.h * srcImg.naturalHeight
  const dw = crops.left.w  * srcImg.naturalWidth
  const h  = boxScale
  const w  = (fw / fh) * h
  const d  = (dw / fh) * h
  return {
    w: Math.max(0.05, w),
    h: Math.max(0.03, h),
    d: Math.max(0.02, d),
    wMM: Math.round(w * 100),
    hMM: Math.round(h * 100),
    dMM: Math.round(d * 100),
  }
}

const useStore = create((set, get) => ({
  // ── Dieline ──
  srcImg:       null,
  crops:        { ...DEFAULT_CROPS },
  selectedFace: 'front',

  // ── Textures: HTMLCanvasElement (sinxron — async flash yo'q) ──
  textures: { front: null, back: null, left: null, right: null, top: null, bottom: null },

  // ── Box o'lchami: faqat bitta scale (balandlik mm) ──
  boxScale: 1.0,   // 1.0 = 100mm

  // ── Render ──
  bgMode:        'dark',
  customBgColor: '#c83050',
  autoRotate:    true,
  shadowEnabled: true,
  brightness:    1.2,
  envIntensity:  0.4,

  // ── Export ──
  exportQuality: 2048,

  // ── Camera ──
  cameraTarget: null,

  // ── Shot ──
  shotRequest: null,

  // ── UI ──
  showDieline: true,
  flashMsg:    null,

  // ════════════════════════════════════════════════════
  // ACTIONS
  // ════════════════════════════════════════════════════

  setSrcImg: (img) => set({ srcImg: img }),
  setSelectedFace: (face) => set({ selectedFace: face }),

  // Cropni o'zgartir VA bir vaqtda texture+dims yangilansin (atomik)
  setCropAndRefresh: (face, crop) => {
    const s = get()
    const newCrops = { ...s.crops, [face]: crop }
    const textures = _extractAll(s.srcImg, newCrops)
    set({ crops: newCrops, textures })
    // dims BoxMesh ichida computed getBoxDims() orqali o'qiladi — qo'shimcha state kerak emas
  },

  // Barcha yuzlarni qayta kesib olish (Avtomatik aniqlashdan keyin)
  refreshAll: () => {
    const { srcImg, crops } = get()
    const textures = _extractAll(srcImg, crops)
    set({ textures })
  },

  // Demo uchun canvas to'plamini to'g'ridan berish
  setAllTextures: (canvasMap) => set({ textures: canvasMap }),

  // Balandlikni o'zgartirish (proporsional — W va D avtomatik)
  setBoxScale: (v) => set({ boxScale: Math.max(0.3, Math.min(4.0, v)) }),

  // Preset: mm → scale
  setPresetMM: (wMM, hMM, dMM) => {
    const { srcImg, crops } = get()
    // Agar rasm bo'lmasa, shunchaki scale qo'yilsin (H asosida)
    set({ boxScale: hMM / 100 })
  },

  toggleAutoRotate: () => set(s => ({ autoRotate: !s.autoRotate })),
  toggleShadow:     () => set(s => ({ shadowEnabled: !s.shadowEnabled })),
  setBgMode:        (m) => set({ bgMode: m }),

  setCustomBgColor: (hex) => {
    const col = parseInt(hex.replace('#', ''), 16)
    const cp  = BG_PRESETS.find(p => p.id === 'custom')
    if (cp) { cp.style = hex; cp.threeColor = col }
    set({ customBgColor: hex, bgMode: 'custom' })
  },

  setBrightness:    (v) => set({ brightness: v }),
  setEnvIntensity:  (v) => set({ envIntensity: v }),
  setExportQuality: (q) => set({ exportQuality: q }),
  setCameraTarget:  (v) => set({ cameraTarget: v }),
  toggleDieline:    ()  => set(s => ({ showDieline: !s.showDieline })),
  requestShot:      (o) => set({ shotRequest: { ...o, _id: Date.now() } }),
  clearShotRequest: ()  => set({ shotRequest: null }),

  showFlash: (msg, dur = 2000) => {
    set({ flashMsg: msg })
    setTimeout(() => set(s => s.flashMsg === msg ? { flashMsg: null } : {}), dur)
  },

  // Box dims (computed, Three.js units)
  getBoxDims: () => computeBoxDims(get().srcImg, get().crops, get().boxScale),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Private: barcha yuzlarni sinxron canvas ga kesib olish
// ─────────────────────────────────────────────────────────────────────────────
function _extractAll(srcImg, crops) {
  if (!srcImg) return {}
  const out = {}
  for (const [face, f] of Object.entries(crops)) {
    const c = cropToCanvas(srcImg, f)
    if (c) out[face] = c
  }
  return out
}

export default useStore
