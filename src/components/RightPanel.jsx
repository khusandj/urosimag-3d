import { useRef, useCallback } from 'react'
import useStore, { BG_PRESETS, computeBoxDims, cropToCanvas } from '../store'
import {
  Camera, RotateCw, Ruler, ArrowUpDown,
  Palette, Pipette,
  Sun, Lightbulb, Cloudy, Sparkles, Eclipse,
  Download, Square, FileArchive,
  ChevronRight,
} from 'lucide-react'

export default function RightPanel() {
  return (
    <div style={{
      width: 248, background:'var(--bg-panel)', borderLeft:'1px solid var(--border)',
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

// ── Collapsible section wrapper ────────────────
function Section({ id, icon, title, children, defaultOpen = true }) {
  const collapsed = useStore(s => s.collapsedSections[id])
  const toggle    = useStore(s => s.toggleSection)
  const isOpen = collapsed === undefined ? defaultOpen : !collapsed

  return (
    <div className="panel-section">
      <h3
        onClick={() => toggle(id)}
        style={{ cursor: 'pointer', userSelect: 'none', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon} {title}
        </span>
        <ChevronRight
          size={12}
          style={{
            transition: 'transform .2s',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            opacity: 0.4,
          }}
        />
      </h3>
      {isOpen && children}
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
    ['right',"O'ng"],['top','Yuqori'],['iso','Burchak'],
  ]
  return (
    <Section id="camera" icon={<Camera size={12}/>} title="Rakurslar">
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginBottom:10}}>
        {views.map(([id,label]) => (
          <button key={id} className="view-btn" onClick={()=>setCameraTarget(id)}>{label}</button>
        ))}
      </div>
      <ToggleRow label="Avto-aylantirish" icon={<RotateCw size={12}/>} on={autoRotate} onClick={toggleAutoRotate} />
      <div style={{marginTop:8}}>
        <SliderRow label="FOV" val={`${fov}°`} min={20} max={90} step={1} value={fov} onChange={v=>setFov(+v)} />
      </div>
      <div style={{fontSize:9,color:'var(--text-tertiary)',marginTop:6,lineHeight:1.7, display:'flex',flexWrap:'wrap',gap:4}}>
        <kbd>1-6</kbd> rakurslar
        <kbd>Space</kbd> aylantirish
        <kbd>Ctrl+S</kbd> saqlash
        <kbd>Ctrl+Z</kbd> undo
      </div>
    </Section>
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
  const ratio = dims.dMM / dims.wMM
  const isTooFlat = ratio < 0.10

  const setDepthRatio = useCallback((targetRatio) => {
    const s = useStore.getState()
    if (!s.srcImg) return
    const front = s.crops.front
    const newLeftW = Math.min(0.45, front.w * targetRatio)
    const newLeft  = { ...s.crops.left, w: newLeftW }
    const newCrops = { ...s.crops, left: newLeft }
    const newCanvas = cropToCanvas(s.srcImg, newLeft)
    const textures  = newCanvas ? { ...s.textures, left: newCanvas } : s.textures
    useStore.setState({ crops: newCrops, textures })
    showFlash(`D nisbati tuzatildi (${Math.round(targetRatio*100)}%)`, 1500)
  }, [showFlash])

  const presets = [
    [180,100,70,'Standart'],[160,90,60,'Kichik'],[200,110,80,'Katta'],[120,80,40,'Nozik'],
  ]

  return (
    <Section id="dims" icon={<Ruler size={12}/>} title="O'lcham">
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
        gap:1, marginBottom:8, overflow:'hidden',
        background:'var(--border)', borderRadius:'var(--radius)',
        border: isTooFlat ? '1px solid var(--danger)' : '1px solid var(--border)',
      }}>
        {[['W', dims.wMM, 'var(--success)'],['H', dims.hMM, 'var(--accent)'],['D', dims.dMM, 'var(--warning)']].map(([ax,val,col]) => (
          <div key={ax} style={{textAlign:'center', background:'var(--bg-elevated)', padding:'8px 4px'}}>
            <div style={{fontSize:9, color:'var(--text-tertiary)', marginBottom:2}}>{ax}</div>
            <div style={{fontSize:15, fontWeight:700, color:col, fontVariantNumeric:'tabular-nums'}}>{val}</div>
            <div style={{fontSize:9, color:'var(--text-tertiary)'}}>mm</div>
          </div>
        ))}
      </div>

      {isTooFlat && (
        <div style={{
          background:'rgba(224,80,80,.08)', border:'1px solid rgba(224,80,80,.2)',
          borderRadius:'var(--radius)', padding:'8px 10px', marginBottom:8, fontSize:10, color:'#e08080',
        }}>
          D juda kichik ({dims.dMM}mm). Dieline da Chap yuzini kengaytiring:
          <div style={{display:'flex',gap:4,marginTop:6}}>
            {[[0.30,'30%'],[0.40,'40%'],[0.50,'50%']].map(([r,l])=>(
              <button key={r} onClick={()=>setDepthRatio(r)} className="chip" style={{fontSize:10,borderColor:'rgba(224,80,80,.25)',color:'#e08080'}}>
                D={l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <label style={{fontSize:10,color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:4}}>
            <ArrowUpDown size={11}/> Balandlik
          </label>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <input className="num-input" type="number" min={30} max={400} value={hMM}
              onChange={e => setBoxScale(parseFloat(e.target.value)/100)} />
            <span style={{fontSize:9,color:'var(--text-tertiary)'}}>mm</span>
          </div>
        </div>
        <input type="range" min={30} max={400} step={1} value={hMM}
          onChange={e => setBoxScale(parseFloat(e.target.value)/100)} />
      </div>

      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
        {presets.map(([w,h,d,lbl]) => (
          <button key={`${w}x${h}x${d}`}
            className={`chip${dims.hMM===h?' active':''}`}
            onClick={()=>setPresetMM(w,h,d)}
            title={`${w}×${h}×${d}mm`}>
            {lbl}
          </button>
        ))}
      </div>
    </Section>
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
    <Section id="bg" icon={<Palette size={12}/>} title="Orqa fon">
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:8}}>
        {BG_PRESETS.map(p => {
          const bgStyle = p.id === 'custom' ? customBgColor : p.style
          const isActive = bgMode === p.id
          return (
            <div key={p.id} title={p.label}
              onClick={()=>p.id==='custom'?colorRef.current.click():setBgMode(p.id)}
              style={{
                aspectRatio:'1', borderRadius:'var(--radius)', cursor:'pointer',
                background: bgStyle,
                border: `2px solid ${isActive?'var(--accent)':'transparent'}`,
                outline: isActive ? '1px solid var(--accent)' : 'none',
                outlineOffset: 1,
                transition:'all .15s ease',
                position:'relative', overflow:'hidden',
              }}
            >
              {p.id === 'custom' && (
                <Pipette size={14} style={{
                  position:'absolute', top:'50%', left:'50%',
                  transform:'translate(-50%,-50%)',
                  color:'#fff', opacity:0.6,
                }}/>
              )}
            </div>
          )
        })}
      </div>
      <input ref={colorRef} type="color" value={customBgColor}
        onChange={e=>setCustomBgColor(e.target.value)} style={{display:'none'}}/>
      <div style={{fontSize:10,color:'var(--text-tertiary)',textAlign:'center'}}>
        {bgMode==='transp'
          ? <span>Shaffof <span style={{color:'#60c8c8'}}>— PNG da shaffof</span></span>
          : BG_PRESETS.find(p=>p.id===bgMode)?.label || 'Maxsus rang'
        }
      </div>
    </Section>
  )
}

// ── Lighting ────────────────────────────────────
const ENV_PRESETS = [
  { id:'studio',    label:'Studiya'   },
  { id:'warehouse', label:'Ombor'     },
  { id:'sunset',    label:'Quyosh'    },
  { id:'dawn',      label:'Tong'      },
  { id:'city',      label:'Shahar'    },
  { id:'forest',    label:"O'rmon"    },
  { id:'apartment', label:'Xona'      },
  { id:'lobby',     label:'Zal'       },
  { id:'night',     label:'Tun'       },
  { id:'park',      label:'Park'      },
]

function LightSection() {
  // P4.10: Keraksiz ref lar olib tashlandi
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

  return (
    <Section id="light" icon={<Sun size={12}/>} title="Yoritish">
      <SubLabel>Muhit (Environment)</SubLabel>
      <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:8}}>
        {ENV_PRESETS.map(p => (
          <button key={p.id}
            className={`chip${envPreset===p.id?' active':''}`}
            onClick={()=>setEnvPreset(p.id)}
            style={{fontSize:10, padding:'4px 8px'}}
          >{p.label}</button>
        ))}
      </div>

      <SliderRow label="Yorqinlik" val={brightness.toFixed(2)} min={.2} max={3} step={.05} value={brightness} onChange={v=>setBrightness(+v)} />
      <SliderRow label="Muhit aksi" val={envIntensity.toFixed(2)} min={0} max={2} step={.05} value={envIntensity} onChange={v=>setEnvIntensity(+v)} />

      <Divider />

      <SubLabel icon={<Lightbulb size={11}/>}>Asosiy nur</SubLabel>
      <SliderRow label="Kuch" val={lightIntensity.toFixed(1)} min={0} max={6} step={0.1} value={lightIntensity} onChange={v=>setLightIntensity(+v)} />
      <SliderRow label="Azimut" val={`${lightAzimuth}°`} min={-180} max={180} step={1} value={lightAzimuth} onChange={v=>setLightAzimuth(+v)} />
      <SliderRow label="Balandlik" val={`${lightElevation}°`} min={5} max={90} step={1} value={lightElevation} onChange={v=>setLightElevation(+v)} />

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:10,color:'var(--text-secondary)'}}>Rang</span>
        <ColorDot value={lightColor} onChange={setLightColor} />
      </div>

      <div style={{display:'flex',gap:3,marginBottom:8,flexWrap:'wrap'}}>
        {[
          {label:'Yuqori-old', az:30,  el:65},
          {label:'Yuqori',     az:0,   el:85},
          {label:'Chap',       az:-90, el:45},
          {label:"O'ng",       az:90,  el:45},
          {label:'Orqa',       az:180, el:50},
          {label:'Past',       az:30,  el:15},
        ].map(p=>(
          <button key={p.label} className="chip" style={{fontSize:9, padding:'3px 7px'}}
            onClick={()=>{setLightAzimuth(p.az);setLightElevation(p.el)}}
          >{p.label}</button>
        ))}
      </div>

      <Divider />

      <SubLabel icon={<Cloudy size={11}/>}>Ambient</SubLabel>
      <SliderRow label="Kuch" val={ambientIntensity.toFixed(2)} min={0} max={2} step={.05} value={ambientIntensity} onChange={v=>setAmbientIntensity(+v)} />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:10,color:'var(--text-secondary)'}}>Rang</span>
        <ColorDot value={ambientColor} onChange={setAmbientColor} />
      </div>

      <Divider />

      <ToggleRow label="Rim nur" icon={<Sparkles size={12}/>} on={rimLight} onClick={toggleRimLight} />
      {rimLight && (
        <>
          <SliderRow label="Kuch" val={rimIntensity.toFixed(2)} min={0} max={2} step={.05} value={rimIntensity} onChange={v=>setRimIntensity(+v)} />
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:10,color:'var(--text-secondary)'}}>Rang</span>
            <ColorDot value={rimColor} onChange={setRimColor} />
          </div>
        </>
      )}

      <Divider />

      <ToggleRow label="Soya" icon={<Eclipse size={12}/>} on={shadowEnabled} onClick={toggleShadow} />
      {shadowEnabled && (
        <SliderRow label="Quyuqlik" val={shadowOpacity.toFixed(2)} min={0} max={.6} step={.01} value={shadowOpacity} onChange={v=>setShadowOpacity(+v)} />
      )}
    </Section>
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
    { id:'png',  label:'PNG'  },
    { id:'jpg',  label:'JPEG' },
    { id:'webp', label:'WebP' },
  ]

  return (
    <Section id="export" icon={<Download size={12}/>} title="Eksport">
      <SubLabel>Sifat</SubLabel>
      <div className="seg-group" style={{marginBottom:10}}>
        {Object.entries(QL).map(([k,v]) => (
          <button key={k} className={`seg-btn${exportQuality===v?' active':''}`}
            onClick={()=>setExportQuality(v)}>{k}</button>
        ))}
      </div>

      <SubLabel>Format</SubLabel>
      <div className="seg-group" style={{marginBottom:12}}>
        {FMTS.map(f => (
          <button key={f.id} className={`seg-btn${exportFmt===f.id?' active':''}`}
            onClick={()=>setExportFmt(f.id)}>{f.label}</button>
        ))}
      </div>

      <button className="btn-primary" onClick={()=>requestShot({quality:exportQuality,transparent:false,fmt:exportFmt})}>
        <Download size={14} /> Saqlash ({qLabel})
      </button>
      {isTransp && (
        <button className="btn-teal" onClick={()=>requestShot({quality:exportQuality,transparent:true,fmt:'png'})}>
          <Square size={14} /> Shaffof PNG
        </button>
      )}
      <button className="btn-ghost" onClick={()=>requestShot({quality:exportQuality,transparent:isTransp,views:'all',fmt:exportFmt})}>
        <FileArchive size={14} /> 6 rakurs → ZIP
      </button>
    </Section>
  )
}

// ── Shared components ──────────────────────────
function SliderRow({ label, val, min, max, step, value, onChange }) {
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <label style={{fontSize:10,color:'var(--text-secondary)'}}>{label}</label>
        <span style={{fontSize:10,color:'var(--text-accent)',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(e.target.value)}/>
    </div>
  )
}

function SubLabel({ children, icon }) {
  return (
    <div style={{fontSize:10,color:'var(--text-tertiary)',marginBottom:5,fontWeight:500, display:'flex',alignItems:'center',gap:4}}>
      {icon}{children}
    </div>
  )
}

function Divider() {
  return <div style={{borderTop:'1px solid var(--border)',margin:'10px 0'}}/>
}

// P4.10 FIX: ref_ prop olib tashlandi — ichki ref yetarli
function ColorDot({ value, onChange }) {
  const inputRef = useRef()
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div
        onClick={()=>inputRef.current.click()}
        className="color-dot"
        style={{ width:22, height:22, borderRadius:6, background:value,
          border:'2px solid var(--border-bright)', cursor:'pointer', flexShrink:0,
        }}
      />
      <span style={{fontSize:9,color:'var(--text-tertiary)',fontFamily:'monospace'}}>{value}</span>
      <input ref={inputRef} type="color" value={value}
        onChange={e=>onChange(e.target.value)}
        style={{display:'none'}} />
    </div>
  )
}

function ToggleRow({ label, icon, on, onClick }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
      <span style={{fontSize:10,color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:5}}>
        {icon}{label}
      </span>
      <div className={`toggle ${on?'on':''}`} onClick={onClick} role="switch" aria-checked={on} />
    </div>
  )
}
