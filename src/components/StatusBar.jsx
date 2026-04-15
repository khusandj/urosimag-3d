import { Mouse, Maximize2 } from 'lucide-react'
import useStore, { computeBoxDims } from '../store'

export default function StatusBar() {
  const srcImg   = useStore(s => s.srcImg)
  const crops    = useStore(s => s.crops)
  const boxScale = useStore(s => s.boxScale)
  const dims     = computeBoxDims(srcImg, crops, boxScale)

  return (
    <div style={{
      background: 'var(--bg-panel)',
      borderTop: '1px solid var(--border)',
      padding: '5px 16px',
      fontSize: 10,
      color: 'var(--text-tertiary)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0,
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Mouse size={11} style={{ opacity: 0.4 }} />
        <span>LMB: aylantirish · Scroll: zoom · RMB: siljitish</span>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--text-secondary)',
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
      }}>
        <Maximize2 size={10} style={{ opacity: 0.5 }} />
        {dims.wMM} × {dims.hMM} × {dims.dMM} mm
      </div>
    </div>
  )
}
