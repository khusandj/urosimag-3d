import { useEffect } from 'react'
import useStore from './store'
import Header from './components/Header'
import DielineEditor from './components/DielineEditor'
import BoxScene from './components/BoxScene'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'

export default function App() {
  const showDieline = useStore(s => s.showDieline)
  const flashMsg    = useStore(s => s.flashMsg)

  // ── Global keyboard shortcuts ──────────────────
  useEffect(() => {
    const CAM_KEYS = { '1':'front','2':'back','3':'left','4':'right','5':'top','6':'iso' }

    const onKeyDown = (e) => {
      // Input elementda bo'lsa — shortcuts ishlamasin
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const s = useStore.getState()

      // 1–6: kamera rakurslari
      if (CAM_KEYS[e.key]) {
        s.setCameraTarget(CAM_KEYS[e.key])
        return
      }

      switch(e.key) {
        // Space: avto-aylantirish on/off
        case ' ':
          e.preventDefault()
          s.toggleAutoRotate()
          s.showFlash(s.autoRotate ? '⏸ Aylantirish to\'xtatildi' : '▶ Aylantirish', 1200)
          break

        // H: dieline panelni yashir/ko'rsat
        case 'h': case 'H':
          s.toggleDieline()
          break

        // Ctrl+S: joriy sozlamalar bilan saqlash
        case 's': case 'S':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            s.requestShot({ quality: s.exportQuality, transparent: s.bgMode==='transp', fmt: s.exportFmt })
            s.showFlash('💾 Saqlanmoqda...', 1000)
          }
          break

        // Ctrl+Z: undo crop
        case 'z': case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            s.undoCrop()
            s.showFlash('↩ Undo', 1000)
          }
          break

        // R: reset kamera isoga
        case 'r': case 'R':
          s.setCameraTarget('iso')
          break

        default: break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <Header />

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {showDieline && <DielineEditor />}
        <BoxScene flashMsg={flashMsg} />
        <RightPanel />
      </div>

      <StatusBar />
    </div>
  )
}
