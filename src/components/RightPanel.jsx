import { useRef, useCallback, useMemo } from 'react'
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
  const showFlash   = useStore(s => s.showFlash)

  const dims  = computeBoxDims(srcImg, crops, boxScale)
  const hMM   = dims.hMM
  const ratio = dims.dMM / dims.wMM   // D/W nisbati
  const isTooFlat = ratio < 0.10       // juda yassiq

  // Tezkor proporsiya o'rnatuvchi: crops.left.w ni korreksiya qilish
  const setDepthRatio = useCallback((targetRatio) => {
    const s = useStore.getState()
    if (!s.srcImg) return
    import('../store').then(({ cropToCanvas }) => {
      const front = s.crops.front
      // left.w = front.w * targetRatio (front kengligiga nisbatan)
      const newLeftW = Math.min(0.45, front.w * targetRatio)
      const newLeft  = { ...s.crops.left, w: newLeftW }
      const newCrops = { ...s.crops, left: newLeft }
      const newCanvas = cropToCanvas(s.srcImg, newLeft)
      const textures  = newCanvas ? { ...s.textures, left: newCanvas } : s.textures
      useStore.setState({ crops: newCrops, textures })
      showFlash(`D nisbati tuzatildi (${Math.round(targetRatio*100)}%)`, 1500)
    })
  }, [showFlash])

  const presets = [
    [180,100,70,'Standart'],[160,90,60,'Kichik'],[200,110,80,'Katta'],[120,80,40,'Nozik'],
  ]

  return (
    <div className="panel-section">
      <h3>Karobka o'lchami</h3>

      {/* W × H × D */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
        gap:4, marginBottom:6,
        background:'rgba(0,0,0,.3)', borderRadius:6, padding:7,
        border:`1px solid ${isTooFlat?'#a04020':'#2a1800'}`,
      }}>
        {[['W', dims.wMM, '#3dc85a'],['H', dims.hMM, '#e8c050'],['D', dims.dMM, '#dca020']].map(([ax,val,col]) => (
          <div key={ax} style={{textAlign:'center'}}>
            <div style={{fontSize:9, color:'#605020', marginBottom:2}}>{ax}</div>
            <div style={{fontSize:14, fontWeight:700, color:col}}>{val}</div>
            <div style={{fontSize:9, color:'#504020'}}>mm</div>
          </div>
        ))}
      </div>

      {/* Ogohlantirish: juda yassiq */}
      {isTooFlat && (
        <div style={{
          background:'rgba(180,60,0,.18)', border:'1px solid #a04020',
          borderRadius:5, padding:'5px 8px', marginBottom:8, fontSize:9, color:'#e09060',
        }}>
          ⚠️ D juda kichik ({dims.dMM}mm). Dieline editorida <b>Chap</b> yuzini kengaytiring
          yoki pastdagi tugmani bosing:
          <div style={{display:'flex',gap:3,marginTop:5,flexWrap:'wrap'}}>
            {[[0.30,'30%'],[0.40,'40%'],[0.50,'50%']].map(([r,l])=>(
              <button key={r} onClick={()=>setDepthRatio(r)} style={{
                padding:'3px 7px', borderRadius:4, fontSize:9, cursor:'pointer',
                border:'1px solid #a06030', background:'rgba(200,100,20,.25)', color:'#e8a060',
              }}>D={l} tuzat</button>
            ))}
          </div>
        </div>
      )}

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
        {presets.map(([w,h,d,lbl]) => (
          <PresetBtn key={`${w}x${h}x${d}`} active={dims.hMM===h}
            onClick={()=>setPresetMM(w,h,d)}
            title={`${w}×${h}×${d}mm`}>
            {lbl}
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
const ENV_PRESETS = [
  { id:'studio',    emoji:'🎬', label:'Studiya'   },
  { id:'warehouse', emoji:'🏭', label:'Ombor'     },
  { id:'sunset',    emoji:'🌅', label:'Quyosh'    },
  { id:'dawn',      emoji:'🌄', label:'Tong'      },
  { id:'city',      emoji:'🌆', label:'Shahar'    },
  { id:'forest',    emoji:'🌲', label:"O'rmon"    },
  { id:'apartment', emoji:'🏠', label:'Xona'      },
  { id:'lobby',     emoji:'🏛', label:'Zal'       },
  { id:'night',     emoji:'🌙', label:'Tun'       },
  { id:'park',      emoji:'🌳', label:'Park'      },
]

function LightSection() {
  const brightness       = useStore(s => s.brightness)
  const envIntensity     = useStore(s => s.envIntensity)
  const envPreset        = useStore(s => s.envPreset)
  const shadowEnabled    = useStore(s => s.shadowEnabled)
  const shadowOpacity    = useStore(s => s.shadowOpacity)
  const lightAzimuth     = useStore(s => s.lightAzimuth)
  const lightElevation   = useStore(s => s.lightElevation)
  const lightColor       = useStore(s => s.lightColor)
  const lightIntensity   = useStore(s => s.lightIntensity)
  const ambientColor     = useStore(s => s.ambientColor)
  const ambientIntensity = useStore(s => s.ambientIntensity)
  const rimLight         = useStore(s => s.rimLight)
  const rimIntensity     = useStore(s => s.rimIntensity)
  const rimColor         = useStore(s => s.rimColor)

  const setBrightness        = useStore(s => s.setBrightness)
  const setEnvIntensity      = useStore(s => s.setEnvIntensity)
  const setEnvPreset         = useStore(s => s.setEnvPreset)
  const toggleShadow         = useStore(s => s.toggleShadow)
  const setShadowOpacity     = useStore(s => s.setShadowOpacity)
  const setLightAzimuth      = useStore(s => s.setLightAzimuth)
  const setLightElevation    = useStore(s => s.setLightElevation)
  const setLightColor        = useStore(s => s.setLightColor)
  const setLightIntensity    = useStore(s => s.setLightIntensity)
  const setAmbientColor      = useStore(s => s.setAmbientColor)
  const setAmbientIntensity  = useStore(s => s.setAmbientIntensity)
  const toggleRimLight       = useStore(s => s.toggleRimLight)
  const setRimIntensity      = useStore(s => s.setRimIntensity)
  const setRimColor          = useStore(s => s.setRimColor)

  const mainLightRef  = useRef()
  const ambientRef    = useRef()
  const rimColorRef   = useRef()

  return (
    <div className="panel-section">
      <h3>Yoritish va Muhit</h3>

      {/* Environment preset */}
      <div style={{fontSize:9,color:'#4a3010',marginBottom:5}}>Muhit (Environment):</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:3,marginBottom:10}}>
        {ENV_PRESETS.map(p => (
          <button key={p.id} title={p.label} onClick={()=>setEnvPreset(p.id)} style={{
            padding:'5px 2px', borderRadius:5, fontSize:14, cursor:'pointer',
            border:`1px solid ${envPreset===p.id?'#e8c050':'#2a1800'}`,
            background: envPreset===p.id?'rgba(200,160,30,.3)':'rgba(200,150,20,.06)',
            transition:'all .15s', lineHeight:1,
          }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(200,160,30,.2)'}
          onMouseLeave={e=>e.currentTarget.style.background=envPreset===p.id?'rgba(200,160,30,.3)':'rgba(200,150,20,.06)'}
          >{p.emoji}</button>
        ))}
      </div>
      <div style={{fontSize:9,color:'#706030',marginBottom:8,textAlign:'center'}}>
        {ENV_PRESETS.find(p=>p.id===envPreset)?.label || envPreset}
      </div>

      {/* Umumiy yorqinlik */}
      <SliderRow label="Umumiy yorqinlik" val={brightness.toFixed(2)} min={.2} max={3} step={.05} value={brightness} onChange={v=>setBrightness(+v)} />
      <SliderRow label="Muhit aksi"       val={envIntensity.toFixed(2)} min={0} max={2} step={.05} value={envIntensity} onChange={v=>setEnvIntensity(+v)} />

      <Divider />

      {/* Asosiy nur */}
      <div style={{fontSize:9,color:'#c8a040',marginBottom:5,fontWeight:600}}>☀ Asosiy nur</div>
      <SliderRow
        label="Kuch"
        val={lightIntensity.toFixed(1)}
        min={0} max={6} step={0.1}
        value={lightIntensity}
        onChange={v=>setLightIntensity(+v)}
      />
      <div style={{marginBottom:7}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <label style={{fontSize:10,color:'#907030'}}>Gorizontal (azimut)</label>
          <span style={{fontSize:10,color:'#e8c050',fontWeight:600}}>{lightAzimuth}°</span>
        </div>
        <input type="range" min={-180} max={180} step={1} value={lightAzimuth}
          onChange={e=>setLightAzimuth(+e.target.value)} />
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#3a2200'}}>
          <span>Chap</span><span>Old</span><span>O'ng</span>
        </div>
      </div>
      <div style={{marginBottom:7}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <label style={{fontSize:10,color:'#907030'}}>Vertikal (balandlik)</label>
          <span style={{fontSize:10,color:'#e8c050',fontWeight:600}}>{lightElevation}°</span>
        </div>
        <input type="range" min={5} max={90} step={1} value={lightElevation}
          onChange={e=>setLightElevation(+e.target.value)} />
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#3a2200'}}>
          <span>Yon</span><span>Baland</span>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:10,color:'#907030'}}>Nur rangi</span>
        <ColorDot value={lightColor} ref_={mainLightRef} onChange={setLightColor} />
      </div>

      {/* Nur yo'nalishi preset tugmalari */}
      <div style={{display:'flex',gap:3,marginBottom:8,flexWrap:'wrap'}}>
        {[
          {label:'Yuqori-old', az:30,  el:65},
          {label:'Yuqori',     az:0,   el:85},
          {label:'Chap',       az:-90, el:45},
          {label:"O'ng",       az:90,  el:45},
          {label:'Orqa',       az:180, el:50},
          {label:'Pastki',     az:30,  el:15},
        ].map(p=>(
          <button key={p.label} onClick={()=>{setLightAzimuth(p.az);setLightElevation(p.el)}} style={{
            padding:'3px 6px', borderRadius:4, fontSize:9, cursor:'pointer',
            border:'1px solid #3a2200', background:'rgba(200,150,20,.07)', color:'#907030',
            transition:'all .15s',
          }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(200,150,20,.22)';e.currentTarget.style.color='#e8c050'}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(200,150,20,.07)';e.currentTarget.style.color='#907030'}}
          >{p.label}</button>
        ))}
      </div>

      <Divider />

      {/* Ambient (muhit yoritishi) */}
      <div style={{fontSize:9,color:'#a0c0e0',marginBottom:5,fontWeight:600}}>🌫 Ambient</div>
      <SliderRow label="Kuch" val={ambientIntensity.toFixed(2)} min={0} max={2} step={.05} value={ambientIntensity} onChange={v=>setAmbientIntensity(+v)} />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:10,color:'#907030'}}>Rang</span>
        <ColorDot value={ambientColor} ref_={ambientRef} onChange={setAmbientColor} />
      </div>

      <Divider />

      {/* Rim / Fill nur */}
      <ToggleRow label="💫 Rim nur (kontur)" on={rimLight} onClick={toggleRimLight} />
      {rimLight && (
        <>
          <SliderRow label="Kuch" val={rimIntensity.toFixed(2)} min={0} max={2} step={.05} value={rimIntensity} onChange={v=>setRimIntensity(+v)} />
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:10,color:'#907030'}}>Rang</span>
            <ColorDot value={rimColor} ref_={rimColorRef} onChange={setRimColor} />
          </div>
        </>
      )}

      <Divider />

      {/* Soya */}
      <div style={{fontSize:9,color:'#907030',marginBottom:5,fontWeight:600}}>🔲 Soya</div>
      <ToggleRow label="Soya ko'rsat" on={shadowEnabled} onClick={toggleShadow} />
      {shadowEnabled && (
        <SliderRow label="Quyuqlik" val={shadowOpacity.toFixed(2)} min={0} max={.6} step={.01} value={shadowOpacity} onChange={v=>setShadowOpacity(+v)} />
      )}
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

function PresetBtn({ children, onClick, active, title }) {
  return (
    <button onClick={onClick} title={title} style={{
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

function Divider() {
  return <div style={{borderTop:'1px solid #1e1200',margin:'8px 0'}}/>
}

// Rang tanlash tugmasi — kichik doira
function ColorDot({ value, ref_, onChange }) {
  const inputRef = useRef()
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div
        onClick={()=>inputRef.current.click()}
        style={{
          width:20, height:20, borderRadius:'50%', background:value,
          border:'2px solid #3a2200', cursor:'pointer', flexShrink:0,
          boxShadow:'0 0 0 1px rgba(255,200,50,.2)',
          transition:'transform .15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.2)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
      />
      <span style={{fontSize:9,color:'#605030'}}>{value}</span>
      <input ref={inputRef} type="color" value={value}
        onChange={e=>onChange(e.target.value)}
        style={{display:'none'}} />
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
