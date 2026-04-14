import { useRef } from 'react'
import useStore, { BG_PRESETS, computeBoxDims } from '../store'

export default function RightPanel() {
  return (
    <div style={{
      width: 242, background:'var(--bg-panel2)', borderLeft:'1px solid var(--border)',
      display:'flex', flexDirection:'column', overflowY:'auto', flexShrink:0,
    }}>
      <CameraSection />
      <DimsSection />
      <BgSection />
      <LightSection />
      <ExportSection />
    </div>
  )
}

// ── Camera ──────────────────────────────────────
function CameraSection() {
  const setCameraTarget  = useStore(s => s.setCameraTarget)
  const autoRotate       = useStore(s => s.autoRotate)
  const toggleAutoRotate = useStore(s => s.toggleAutoRotate)
  const fov              = useStore(s => s.fov)
  const setFov           = useStore(s => s.setFov)

  const views = [
    ['front','Old'],['back','Orqa'],['left','Chap'],
    ['right',"O'ng"],['top','Yuqori'],['iso','Diagonal'],
  ]
  return (
    <div className="panel-section">
      <h3>Rakurslar</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginBottom:8}}>
        {views.map(([id,label]) => (
          <ViewBtn key={id} onClick={()=>setCameraTarget(id)}>{label}</ViewBtn>
        ))}
      </div>
      <ToggleRow label="Avto-aylantir" on={autoRotate} onClick={toggleAutoRotate} />
      <div style={{marginTop:6}}>
        <SliderRow
          label="Perspektiva (FOV)"
          val={`${fov}°`}
          min={20} max={90} step={1}
          value={fov}
          onChange={v=>setFov(+v)}
        />
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#3a2200',marginTop:1}}>
          <span>Tor 20°</span><span>Keng 90°</span>
        </div>
      </div>
      <div style={{fontSize:9,color:'#3a1a00',marginTop:5,lineHeight:1.6}}>
        💡 Klaviatura: <span style={{color:'#806030'}}>1-6</span> rakurslar ·{' '}
        <span style={{color:'#806030'}}>Space</span> aylantirish ·{' '}
        <span style={{color:'#806030'}}>Ctrl+S</span> saqlash ·{' '}
        <span style={{color:'#806030'}}>H</span> panel ·{' '}
        <span style={{color:'#806030'}}>Ctrl+Z</span> undo
      </div>
    </div>
  )
}

// ── Dimensions ──────────────────────────────────
function DimsSection() {
  const srcImg      = useStore(s => s.srcImg)
  const crops       = useStore(s => s.crops)
  const boxScale    = useStore(s => s.boxScale)
  const setBoxScale = useStore(s => s.setBoxScale)
  const setPresetMM = useStore(s => s.setPresetMM)

  const dims = computeBoxDims(srcImg, crops, boxScale)
  const hMM  = dims.hMM

  const presets = [
    [180,100,70],[160,90,60],[200,110,80],[120,80,50],
  ]

  return (
    <div className="panel-section">
      <h3>Karobka o'lchami</h3>

      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
        gap:4, marginBottom:10,
        background:'rgba(0,0,0,.3)', borderRadius:6, padding:7,
        border:'1px solid #2a1800',
      }}>
        {[['W', dims.wMM, '#3dc85a'],['H', dims.hMM, '#e8c050'],['D', dims.dMM, '#dca020']].map(([ax,val,col]) => (
          <div key={ax} style={{textAlign:'center'}}>
            <div style={{fontSize:9, color:'#605020', marginBottom:2}}>{ax}</div>
            <div style={{fontSize:14, fontWeight:700, color:col}}>{val}</div>
            <div style={{fontSize:9, color:'#504020'}}>mm</div>
          </div>
        ))}
      </div>

      <div style={{fontSize:9, color:'#4a3010', marginBottom:8, lineHeight:1.5}}>
        ↑ Dieline chiziqlaridan avtomatik.<br/>
        Balandlikni o'zgartiring → W, D proporsional.
      </div>

      <div style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
          <label style={{fontSize:10,color:'#907030'}}>Balandlik (H)</label>
          <div style={{display:'flex',alignItems:'center',gap:3}}>
            <input
              className="num-input"
              type="number" min={30} max={400} value={hMM}
              onChange={e => setBoxScale(parseFloat(e.target.value)/100)}
            />
            <span style={{fontSize:9,color:'#605020'}}>mm</span>
          </div>
        </div>
        <input
          type="range" min={30} max={400} step={1} value={hMM}
          onChange={e => setBoxScale(parseFloat(e.target.value)/100)}
        />
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#3a2200',marginTop:2}}>
          <span>30mm</span><span>400mm</span>
        </div>
      </div>

      <div style={{fontSize:9,color:'#4a3010',marginBottom:5}}>Standart o'lchamlar:</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
        {presets.map(([w,h,d]) => (
          <PresetBtn key={`${w}x${h}x${d}`} active={dims.hMM===h}
            onClick={()=>setPresetMM(w,h,d)}>
            {w}×{h}×{d}
          </PresetBtn>
        ))}
      </div>
    </div>
  )
}

// ── Background ──────────────────────────────────
function BgSection() {
  const bgMode        = useStore(s => s.bgMode)
  const setBgMode     = useStore(s => s.setBgMode)
  const setCustomBgColor = useStore(s => s.setCustomBgColor)
  const customBgColor = useStore(s => s.customBgColor)
  const colorRef      = useRef()

  return (
    <div className="panel-section">
      <h3>Orqa fon</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:6}}>
        {BG_PRESETS.map(p => {
          // custom preset ning style — store dan olinadi
          const bgStyle = p.id === 'custom' ? customBgColor : p.style
          return (
            <div key={p.id} title={p.label}
              onClick={()=>p.id==='custom'?colorRef.current.click():setBgMode(p.id)}
              style={{
                aspectRatio:'1', borderRadius:6, cursor:'pointer',
                background: bgStyle,
                border:`2px solid ${bgMode===p.id?'#e8c050':'transparent'}`,
                outline: bgMode===p.id?'1px solid #a08020':'none',
                transition:'transform .15s',
              }}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
            />
          )
        })}
      </div>
      <input ref={colorRef} type="color" value={customBgColor}
        onChange={e=>setCustomBgColor(e.target.value)} style={{display:'none'}}/>
      <div style={{fontSize:10,color:'#605028',textAlign:'center'}}>
        {bgMode==='transp'
          ? <span>Shaffof <span style={{color:'#60b0e0'}}>— PNG shaffof saqlash</span></span>
          : BG_PRESETS.find(p=>p.id===bgMode)?.label || 'Maxsus rang'
        }
      </div>
    </div>
  )
}

// ── Lighting ────────────────────────────────────
function LightSection() {
  const brightness    = useStore(s => s.brightness)
  const envIntensity  = useStore(s => s.envIntensity)
  const shadowEnabled = useStore(s => s.shadowEnabled)
  const setBrightness   = useStore(s => s.setBrightness)
  const setEnvIntensity = useStore(s => s.setEnvIntensity)
  const toggleShadow    = useStore(s => s.toggleShadow)

  return (
    <div className="panel-section">
      <h3>Yoritish</h3>
      <SliderRow label="Yorqinlik"      val={brightness.toFixed(2)}   min={.2} max={3}  step={.05} value={brightness}   onChange={v=>setBrightness(+v)} />
      <SliderRow label="Muhit aksi"     val={envIntensity.toFixed(2)} min={0}  max={2}  step={.05} value={envIntensity} onChange={v=>setEnvIntensity(+v)} />
      <ToggleRow label="Soya" on={shadowEnabled} onClick={toggleShadow} />
    </div>
  )
}

// ── Export ──────────────────────────────────────
function ExportSection() {
  const exportQuality   = useStore(s => s.exportQuality)
  const exportFmt       = useStore(s => s.exportFmt)
  const bgMode          = useStore(s => s.bgMode)
  const setExportQuality = useStore(s => s.setExportQuality)
  const setExportFmt    = useStore(s => s.setExportFmt)
  const requestShot     = useStore(s => s.requestShot)

  const QL = { '1K':1024, '2K':2048, '4K':4096 }
  const qLabel = Object.entries(QL).find(([,v])=>v===exportQuality)?.[0]||'2K'
  const isTransp = bgMode === 'transp'

  const FMTS = [
    { id:'png',  label:'PNG',  desc:'Sifatli' },
    { id:'jpg',  label:'JPEG', desc:'Kichik'  },
    { id:'webp', label:'WebP', desc:'Eng kichik' },
  ]

  return (
    <div className="panel-section">
      <h3>Eksport</h3>

      {/* Sifat */}
      <div style={{fontSize:9,color:'#4a3010',marginBottom:4}}>Sifat (piksel):</div>
      <div style={{display:'flex',gap:4,marginBottom:8}}>
        {Object.entries(QL).map(([k,v]) => (
          <button key={k} onClick={()=>setExportQuality(v)} style={{
            flex:1, padding:'5px 2px', borderRadius:4, fontSize:11, cursor:'pointer',
            border:'1px solid #3a2200', fontWeight:600, transition:'all .15s',
            background: exportQuality===v?'rgba(200,160,30,.3)':'rgba(255,190,30,.06)',
            color: exportQuality===v?'#e8c050':'#907030',
          }}>{k}</button>
        ))}
      </div>

      {/* Format */}
      <div style={{fontSize:9,color:'#4a3010',marginBottom:4}}>Format:</div>
      <div style={{display:'flex',gap:4,marginBottom:10}}>
        {FMTS.map(f => (
          <button key={f.id} onClick={()=>setExportFmt(f.id)} title={f.desc} style={{
            flex:1, padding:'5px 2px', borderRadius:4, fontSize:10, cursor:'pointer',
            border:'1px solid #3a2200', fontWeight:600, transition:'all .15s',
            background: exportFmt===f.id?'rgba(200,160,30,.3)':'rgba(255,190,30,.06)',
            color: exportFmt===f.id?'#e8c050':'#907030',
          }}>{f.label}</button>
        ))}
      </div>

      <button className="btn-gold" onClick={()=>requestShot({quality:exportQuality,transparent:false,fmt:exportFmt})}>
        💾 Saqlash ({qLabel} · {exportFmt.toUpperCase()})
      </button>
      {isTransp && (
        <button className="btn-teal" onClick={()=>requestShot({quality:exportQuality,transparent:true,fmt:'png'})}>
          🔲 Shaffof PNG {qLabel}
        </button>
      )}
      <button className="btn-dark" onClick={()=>requestShot({quality:exportQuality,transparent:isTransp,views:'all',fmt:exportFmt})}>
        📦 Barcha 6 rakurs → ZIP
      </button>

      <div style={{fontSize:9,color:'#3a2000',marginTop:6,lineHeight:1.5}}>
        {exportFmt==='webp' && '✨ WebP: PNG ga qaraganda ~30% kichik'}
        {exportFmt==='jpg'  && '⚡ JPEG: fon yo\'q, tez yuklanadi'}
        {exportFmt==='png'  && '🖼 PNG: eng yuqori sifat, shaffof qo\'llab-quvvatlanadi'}
      </div>
    </div>
  )
}

// ── Shared ────────────────────────────────────────
function ViewBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:'7px 3px', border:'1px solid #3a2200', borderRadius:5,
      background:'rgba(255,190,30,.06)', color:'#907030', fontSize:10,
      cursor:'pointer', textAlign:'center', transition:'all .15s',
    }}
    onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,190,30,.2)';e.currentTarget.style.color='#e8c050'}}
    onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,190,30,.06)';e.currentTarget.style.color='#907030'}}
    >{children}</button>
  )
}

function PresetBtn({ children, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      padding:'3px 7px', borderRadius:4, fontSize:9, cursor:'pointer',
      border:`1px solid ${active?'#c8a040':'#3a2200'}`,
      background: active?'rgba(200,160,30,.25)':'rgba(200,150,30,.06)',
      color: active?'#e8c050':'#907030',
      transition:'all .15s',
    }}>{children}</button>
  )
}

function SliderRow({ label, val, min, max, step, value, onChange }) {
  return (
    <div style={{marginBottom:7}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <label style={{fontSize:10,color:'#907030'}}>{label}</label>
        <span style={{fontSize:10,color:'#e8c050',fontWeight:600}}>{val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(e.target.value)}/>
    </div>
  )
}

function ToggleRow({ label, on, onClick }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
      <span style={{fontSize:10,color:'#907030'}}>{label}</span>
      <div className={`toggle ${on?'on':''}`} onClick={onClick}/>
    </div>
  )
}
