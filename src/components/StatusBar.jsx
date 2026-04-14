import useStore, { computeBoxDims } from '../store'

export default function StatusBar() {
  const srcImg   = useStore(s => s.srcImg)
  const crops    = useStore(s => s.crops)
  const boxScale = useStore(s => s.boxScale)
  const dims     = computeBoxDims(srcImg, crops, boxScale)

  return (
    <div style={{
      background:'#060407', borderTop:'1px solid #221500',
      padding:'4px 14px', fontSize:10, color:'#504020',
      display:'flex', justifyContent:'space-between', flexShrink:0,
    }}>
      <span>Chap klik: aylantirish · Scroll: zoom · O'ng klik: siljitish · Dieline: chiziqni tort → o'lcham yangilanadi</span>
      <span style={{color:'#706030',fontWeight:600}}>
        W:{dims.wMM} × H:{dims.hMM} × D:{dims.dMM} mm
      </span>
    </div>
  )
}
