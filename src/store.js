import { create } from 'zustand'

export const FACE_META = [
  { id: 'front',  label: 'Old',    color: 'rgba(60,200,90,.35)',  stroke: '#3dc85a', threeIdx: 4 },
  { id: 'back',   label: 'Orqa',   color: 'rgba(60,110,220,.35)', stroke: '#4070e8', threeIdx: 5 },
  { id: 'right',  label: "O'ng",   color: 'rgba(220,70,70,.35)',  stroke: '#e04646', threeIdx: 0 },
  { id: 'left',   label: 'Chap',   color: 'rgba(220,160,30,.35)', stroke: '#dca020', threeIdx: 1 },
  { id: 'top',    label: 'Yuqori', color: 'rgba(160,70,220,.35)', stroke: '#a046dc', threeIdx: 2 },
  { id: 'bottom', label: 'Pastki', color: 'rgba(40,200,200,.35)', stroke: '#28c8c8', threeIdx: 3 },
]

export const DEFAULT_CROPS = {
  front:  { x: .22, y: .40, w: .55, h: .30  },
  back:   { x: .01, y: .03, w: .48, h: .36  },
  right:  { x: .76, y: .03, w: .22, h: .64  },
  left:   { x: .01, y: .40, w: .21, h: .30  },
  top:    { x: .22, y: .03, w: .55, h: .065 },
  bottom: { x: .01, y: .72, w: .55, h: .26  },
}

// BG_PRESETS — hech qachon mutate qilinmaydi
export const BG_PRESETS = [
  { id: 'dark',   label: 'Qora',     style: '#07050a',   threeColor: 0x07050a },
  { id: 'light',  label: 'Och',      style: 'linear-gradient(135deg,#d8d0c0,#f0ece0)', threeColor: 0xe0d8c8 },
  { id: 'white',  label: 'Oq',       style: '#ffffff',   threeColor: 0xffffff },
  { id: 'transp', label: 'Shaffof',  style: 'repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 0 0/12px 12px', threeColor: null },
  { id: 'gold',   label: 'Oltin',    style: 'linear-gradient(135deg,#3a2800,#1a1000)', threeColor: 0x1a1000 },
  { id: 'blue',   label: "Ko'k",     style: 'linear-gradient(135deg,#0a0e1a,#101828)', threeColor: 0x0a0e1a },
  { id: 'grad',   label: 'Gradient', style: 'radial-gradient(ellipse at center,#2a2030,#080608)', threeColor: 0x180d20 },
  { id: 'custom', label: 'Rang',     style: null,        threeColor: null },  // style → customBgColor dan
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
  fileName:     null,
  crops:        { ...DEFAULT_CROPS },
  selectedFace: 'front',

  // ── Textures: HTMLCanvasElement (sinxron — async flash yo'q) ──
  textures: { front: null, back: null, left: null, right: null, top: null, bottom: null },

  // ── Undo tarixchasi ──
  cropHistory: [],

  // ── Box o'lchami ──
  boxScale: 1.0,

  // ── Render ──
  bgMode:        'dark',
  customBgColor: '#c83050',
  autoRotate:    true,
  shadowEnabled: true,
  shadowOpacity: 0.18,
  brightness:    1.0,
  envIntensity:  0.25,
  envPreset:     'studio',
  fov:           42,

  // ── Yorug'lik nazorati ──
  lightAzimuth:   40,
  lightElevation: 55,
  lightColor:    '#fff8e8',
  lightIntensity: 1.8,
  ambientColor:  '#f0ead0',
  ambientIntensity: 0.35,
  rimLight:       true,
  rimIntensity:   0.40,
  rimColor:      '#b0c8e8',

  // ── Loading ──
  isLoading: false,

  // ── Export ──
  exportQuality: 2048,
  exportFmt:     'png',

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

  setSrcImg:    (img)  => set({ srcImg: img }),
  setFileName:  (name) => set({ fileName: name }),
  setLoading:   (v)    => set({ isLoading: v }),
  setSelectedFace: (face) => set({ selectedFace: face }),

  // Crop o'zgartirishdan OLDIN joriy holatni tarixchaga qo'sh
  pushCropHistory: () => {
    const { crops } = get()
    set(s => ({
      cropHistory: [...s.cropHistory.slice(-29), JSON.parse(JSON.stringify(crops))]
    }))
  },

  // Undo — oxirgi holatga qaytish
  undoCrop: () => {
    const { cropHistory, srcImg } = get()
    if (!cropHistory.length) return
    const prev = cropHistory[cropHistory.length - 1]
    const textures = _extractAll(srcImg, prev)
    set(s => ({ crops: prev, textures, cropHistory: s.cropHistory.slice(0, -1) }))
  },

  // Cropni o'zgartir VA bir vaqtda texture yangilansin (atomik)
  // Faqat o'zgargan face ning texture qayta yaratiladi — qolgan 5 tasi saqlanadi
  setCropAndRefresh: (face, crop) => {
    const s = get()
    const newCrops   = { ...s.crops, [face]: crop }
    const newCanvas  = s.srcImg ? cropToCanvas(s.srcImg, crop) : null
    const textures   = newCanvas ? { ...s.textures, [face]: newCanvas } : s.textures
    set({ crops: newCrops, textures })
  },

  // Barcha yuzlarni qayta kesib olish
  refreshAll: () => {
    const { srcImg, crops } = get()
    const textures = _extractAll(srcImg, crops)
    set({ textures })
  },

  setAllTextures: (canvasMap) => set({ textures: canvasMap }),

  setBoxScale: (v) => set({ boxScale: Math.max(0.3, Math.min(4.0, v)) }),

  setPresetMM: (wMM, hMM) => {
    set({ boxScale: hMM / 100 })
  },

  setFov: (v) => set({ fov: Math.max(20, Math.min(90, v)) }),

  toggleAutoRotate: () => set(s => ({ autoRotate: !s.autoRotate })),
  toggleShadow:     () => set(s => ({ shadowEnabled: !s.shadowEnabled })),
  setBgMode:        (m) => set({ bgMode: m }),

  // BG_PRESETS mutate qilinmaydi — rang store da saqlanadi
  setCustomBgColor: (hex) => {
    set({ customBgColor: hex, bgMode: 'custom' })
  },

  setBrightness:      (v) => set({ brightness: v }),
  setEnvIntensity:    (v) => set({ envIntensity: v }),
  setEnvPreset:       (v) => set({ envPreset: v }),
  setShadowOpacity:   (v) => set({ shadowOpacity: v }),
  setLightAzimuth:    (v) => set({ lightAzimuth: v }),
  setLightElevation:  (v) => set({ lightElevation: v }),
  setLightColor:      (v) => set({ lightColor: v }),
  setLightIntensity:  (v) => set({ lightIntensity: v }),
  setAmbientColor:    (v) => set({ ambientColor: v }),
  setAmbientIntensity:(v) => set({ ambientIntensity: v }),
  toggleRimLight:     ()  => set(s => ({ rimLight: !s.rimLight })),
  setRimIntensity:    (v) => set({ rimIntensity: v }),
  setRimColor:        (v) => set({ rimColor: v }),
  setExportQuality: (q) => set({ exportQuality: q }),
  setExportFmt:     (f) => set({ exportFmt: f }),
  setCameraTarget:  (v) => set({ cameraTarget: v }),
  toggleDieline:    ()  => set(s => ({ showDieline: !s.showDieline })),
  requestShot:      (o) => set({ shotRequest: { ...o, _id: Date.now() } }),
  clearShotRequest: ()  => set({ shotRequest: null }),

  showFlash: (msg, dur = 2000) => {
    set({ flashMsg: msg })
    setTimeout(() => set(s => s.flashMsg === msg ? { flashMsg: null } : {}), dur)
  },

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
