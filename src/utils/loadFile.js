/**
 * Shared file loader — DielineEditor va BoxScene ikkisi ham shu funksiyani chaqiradi
 * Dublikat yo'q, cropHistory reset qilinadi, Object URL tozalanadi
 */
import useStore, { DEFAULT_CROPS, cropToCanvas } from '../store'
import { autoDetectCrops } from './autoDetect'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return

  // Hajm tekshiruvi
  if (file.size > MAX_FILE_SIZE) {
    useStore.getState().showFlash(`Fayl juda katta (${Math.round(file.size/1024/1024)}MB). Max 20MB`, 3000)
    return
  }

  useStore.setState({ isLoading: true, fileName: file.name })
  const img = new Image()
  const objUrl = URL.createObjectURL(file)

  img.onload = () => {
    // Object URL xotira sizishini oldini olish
    URL.revokeObjectURL(objUrl)

    const detected   = autoDetectCrops(img)
    const finalCrops = detected ? { ...DEFAULT_CROPS, ...detected } : { ...DEFAULT_CROPS }
    const texs       = {}
    for (const [face, f] of Object.entries(finalCrops)) {
      const c = cropToCanvas(img, f)
      if (c) texs[face] = c
    }
    useStore.setState({
      srcImg: img,
      crops: finalCrops,
      textures: texs,
      isLoading: false,
      cropHistory: [],  // Yangi rasm — eski tarixcha tozalanadi
    })
    useStore.getState().showFlash(
      detected ? 'Avtomatik aniqlandi!' : "Qo'lda sozlang", 2500
    )
  }

  img.onerror = () => {
    URL.revokeObjectURL(objUrl)
    useStore.setState({ isLoading: false })
    useStore.getState().showFlash('Rasm yuklanmadi — format tekshiring', 2500)
  }

  img.src = objUrl
}
