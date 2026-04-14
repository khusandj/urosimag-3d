import { useRef, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import JSZip from 'jszip'
import useStore, { BG_PRESETS, computeBoxDims, cropToCanvas, DEFAULT_CROPS } from '../store'
import { autoDetectCrops } from '../utils/autoDetect'

// ─────────────────────────────────────────────────
// BoxMesh — CanvasTexture sinxron, material disposal
// ─────────────────────────────────────────────────
const FACE_ORDER = ['right', 'left', 'top', 'bottom', 'front', 'back']
const DEFAULT_COLORS = {
  right: 0xcca840, left: 0xcca840, top: 0xf0e0b8,
  bottom: 0x5a4008, front: 0xf5eccc, back: 0xcca840,
}

function BoxMesh() {
  const textures = useStore(s => s.textures)
  const srcImg   = useStore(s => s.srcImg)
  const crops    = useStore(s => s.crops)
  const boxScale = useStore(s => s.boxScale)
  const envI     = useStore(s => s.envIntensity)
  const meshRef  = useRef()

  const materials = useMemo(() => {
    return FACE_ORDER.map(face => {
      const canvas = textures[face]
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace      = THREE.SRGBColorSpace
        tex.anisotropy      = 16
        tex.generateMipmaps = true
        tex.minFilter       = THREE.LinearMipmapLinearFilter
        tex.magFilter       = THREE.LinearFilter
        tex.needsUpdate     = true
        return new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.12, metalness: 0.06, envMapIntensity: envI,
        })
      }
      return new THREE.MeshStandardMaterial({
        color: DEFAULT_COLORS[face], roughness: 0.28, metalness: 0.06, envMapIntensity: envI,
      })
    })
  }, [textures, envI])

  // Material va texture disposal — xotira sizmasin
  useEffect(() => {
    return () => {
      materials.forEach(m => {
        if (m.map) m.map.dispose()
        m.dispose()
      })
    }
  }, [materials])

  const { w, h, d } = computeBoxDims(srcImg, crops, boxScale)

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      {materials.map((mat, i) => (
        <primitive key={i} object={mat} attach={`material-${i}`} />
      ))}
    </mesh>
  )
}

// ─────────────────────────────────────────────────
// Environment map — preset reaktiv
// ─────────────────────────────────────────────────
function EnvMap() {
  const envPreset = useStore(s => s.envPreset)
  return <Environment preset={envPreset} />
}

// ─────────────────────────────────────────────────
// FOV sinxronizatsiya
// ─────────────────────────────────────────────────
function FovSync() {
  const fov = useStore(s => s.fov)
  const { camera } = useThree()
  useEffect(() => {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [fov, camera])
  return null
}

// ─────────────────────────────────────────────────
// Camera tween
// ─────────────────────────────────────────────────
const CAM_PRESETS = {
  front:  new THREE.Vector3(0,    0,    4.5),
  back:   new THREE.Vector3(0,    0,   -4.5),
  left:   new THREE.Vector3(-4.5, 0,    0  ),
  right:  new THREE.Vector3(4.5,  0,    0  ),
  top:    new THREE.Vector3(0,    6,    0.01),
  iso:    new THREE.Vector3(3.2,  2,    3.8 ),
}

function CameraRig({ controlsRef }) {
  const cameraTarget    = useStore(s => s.cameraTarget)
  const setCameraTarget = useStore(s => s.setCameraTarget)
  const { camera }      = useThree()
  const tweenRef        = useRef(null)

  useEffect(() => {
    if (!cameraTarget) return
    const to = CAM_PRESETS[cameraTarget]
    if (!to) { setCameraTarget(null); return }
    tweenRef.current = { from: camera.position.clone(), to: to.clone(), t: 0 }
    if (controlsRef.current) controlsRef.current.enabled = false
    setCameraTarget(null)
  }, [cameraTarget])

  useFrame((_, dt) => {
    if (!tweenRef.current) return
    tweenRef.current.t = Math.min(1, tweenRef.current.t + dt * 1.8)
    const t = easeInOut(tweenRef.current.t)
    camera.position.lerpVectors(tweenRef.current.from, tweenRef.current.to, t)
    camera.lookAt(0, 0, 0)
    if (controlsRef.current) { controlsRef.current.target.set(0,0,0); controlsRef.current.update() }
    if (tweenRef.current.t >= 1) {
      tweenRef.current = null
      if (controlsRef.current) controlsRef.current.enabled = true
    }
  })

  return null
}

// ─────────────────────────────────────────────────
// Screenshot handler — JPEG/WebP to'g'ri ishlaydigan
// ─────────────────────────────────────────────────
function ScreenshotHandler({ controlsRef }) {
  const { gl, scene, camera, size } = useThree()
  const shotRequest  = useStore(s => s.shotRequest)
  const clearShotReq = useStore(s => s.clearShotRequest)
  const bgMode       = useStore(s => s.bgMode)
  const customBgColor = useStore(s => s.customBgColor)
  const showFlash    = useStore(s => s.showFlash)
  const busyRef      = useRef(false)

  const takeOne = (quality, transparent, name, fmt = 'png') => {
    const ow = size.width, oh = size.height
    const nw = quality, nh = Math.round(quality / (ow / oh))
    const origBg = scene.background, origFog = scene.fog

    gl.setSize(nw, nh); gl.setPixelRatio(1)
    camera.aspect = nw / nh; camera.updateProjectionMatrix()

    if (transparent) {
      scene.background = null; scene.fog = null; gl.setClearColor(0x000000, 0)
    }

    gl.render(scene, camera)

    // Format va sifat
    const mimeType = fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png'
    const q        = fmt === 'png' ? 1.0 : 0.94
    const ext      = fmt === 'jpg' ? 'jpg' : fmt === 'webp' ? 'webp' : 'png'
    const url      = gl.domElement.toDataURL(mimeType, q)

    // Restore
    gl.setSize(ow, oh); gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    camera.aspect = ow / oh; camera.updateProjectionMatrix()
    if (transparent) {
      scene.background = origBg; scene.fog = origFog
      restoreBg(gl, bgMode, customBgColor)
    }
    gl.render(scene, camera)

    return { url, ext, name: `3d-box-view_${quality/1024}K_${name}${transparent?'_transparent':''}.${ext}` }
  }

  useEffect(() => {
    if (!shotRequest || busyRef.current) return
    busyRef.current = true
    const { quality, transparent, views, fmt = 'png' } = shotRequest

    if (views === 'all') {
      const ALL = [
        { n:'front', p:[0,0,4.5] }, { n:'back',  p:[0,0,-4.5] },
        { n:'left',  p:[-4.5,0,0] }, { n:'right', p:[4.5,0,0] },
        { n:'top',   p:[0,6,.01]  }, { n:'iso',   p:[3.2,2,3.8] },
      ];
      (async () => {
        const zip   = new JSZip()
        const folder = zip.folder('3d-box-view')
        for (let i = 0; i < ALL.length; i++) {
          const v = ALL[i]
          showFlash(`${v.n} saqlanyapti... (${i+1}/6)`, 1200)
          camera.position.set(...v.p)
          camera.lookAt(0, 0, 0)
          if (controlsRef.current) { controlsRef.current.target.set(0,0,0); controlsRef.current.update() }
          await delay(80)
          const { url, ext, name } = takeOne(quality, transparent, v.n, fmt)
          // base64 dan binary ga
          const base64 = url.split(',')[1]
          folder.file(name, base64, { base64: true })
          await delay(60)
        }
        showFlash('ZIP tayyorlanmoqda...', 1500)
        const blob = await zip.generateAsync({ type: 'blob' })
        const a = document.createElement('a')
        a.download = `3d-box-view_${quality/1024}K_all6.zip`
        a.href = URL.createObjectURL(blob)
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
        showFlash(`✅ Barcha 6 rakurs ZIP (${quality/1024}K) saqlandi!`, 3000)
        busyRef.current = false; clearShotReq()
      })()
    } else {
      const az = Math.round((Math.atan2(camera.position.x, camera.position.z) * 180/Math.PI + 360) % 360)
      const { url, ext, name } = takeOne(quality, transparent, `az${az}`, fmt)
      const a = document.createElement('a')
      a.download = name; a.href = url; a.click()
      showFlash(`✅ Saqlandi! (${quality/1024}K · ${fmt.toUpperCase()} · ${quality}×${Math.round(quality/(size.width/size.height))}px)`, 2500)
      busyRef.current = false; clearShotReq()
    }
  }, [shotRequest])

  return null
}

// ─────────────────────────────────────────────────
// Background + Lights + Shadow plane (dinamik Y)
// ─────────────────────────────────────────────────
function SceneSync() {
  const bgMode          = useStore(s => s.bgMode)
  const customBgColor   = useStore(s => s.customBgColor)
  const brightness      = useStore(s => s.brightness)
  const shadowOn        = useStore(s => s.shadowEnabled)
  const shadowOpacity   = useStore(s => s.shadowOpacity)
  const srcImg          = useStore(s => s.srcImg)
  const crops           = useStore(s => s.crops)
  const boxScale        = useStore(s => s.boxScale)
  const lightAzimuth    = useStore(s => s.lightAzimuth)
  const lightElevation  = useStore(s => s.lightElevation)
  const lightColor      = useStore(s => s.lightColor)
  const lightIntensity  = useStore(s => s.lightIntensity)
  const ambientColor    = useStore(s => s.ambientColor)
  const ambientIntensity= useStore(s => s.ambientIntensity)
  const rimLight        = useStore(s => s.rimLight)
  const rimIntensity    = useStore(s => s.rimIntensity)
  const rimColor        = useStore(s => s.rimColor)
  const { scene, gl } = useThree()

  const { h } = computeBoxDims(srcImg, crops, boxScale)
  const shadowY = -(h / 2 + 0.012)

  // Asosiy nurning 3D pozitsiyasi — azimuth + elevation dan
  const az  = lightAzimuth  * Math.PI / 180
  const el  = lightElevation * Math.PI / 180
  const R   = 6
  const lx  = R * Math.cos(el) * Math.sin(az)
  const ly  = R * Math.sin(el)
  const lz  = R * Math.cos(el) * Math.cos(az)

  // Rim nurning pozitsiyasi (asosiyga qarama-qarshi)
  const rx  = -lx * 0.9
  const ry  = ly  * 0.4
  const rz  = -lz * 0.9

  useEffect(() => {
    if (bgMode === 'custom') {
      const col = parseInt(customBgColor.replace('#',''), 16)
      const c   = new THREE.Color(col)
      scene.background = c; scene.fog = new THREE.Fog(c, 8, 22); gl.setClearColor(c, 1)
    } else {
      const p = BG_PRESETS.find(b => b.id === bgMode)
      if (!p) return
      if (p.threeColor == null) {
        scene.background = null; scene.fog = null; gl.setClearColor(0, 0)
      } else {
        const c = new THREE.Color(p.threeColor)
        scene.background = c; scene.fog = new THREE.Fog(c, 8, 22); gl.setClearColor(c, 1)
      }
    }
  }, [bgMode, customBgColor])

  useEffect(() => { gl.shadowMap.enabled = shadowOn }, [shadowOn])

  return (
    <>
      {/* Ambient (umumiy yoritish) */}
      <ambientLight color={ambientColor} intensity={brightness * ambientIntensity} />

      {/* Asosiy nur — yo'nalishi slider bilan boshqariladi */}
      <directionalLight
        color={lightColor}
        intensity={brightness * lightIntensity}
        position={[lx, ly, lz]}
        castShadow={shadowOn}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.001}
      />

      {/* Rim/fill nur — old yorug'likning qarama-qarshi tomoni */}
      {rimLight && (
        <directionalLight
          color={rimColor}
          intensity={brightness * rimIntensity}
          position={[rx, ry, rz]}
        />
      )}

      {/* Past-orqa pastki fill */}
      <directionalLight color="#ffd080" intensity={brightness * 0.22} position={[0, -3, -4]} />

      {/* Shadow plane */}
      <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[0, shadowY, 0]}>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={shadowOpacity} />
      </mesh>
    </>
  )
}

// ─────────────────────────────────────────────────
// Main BoxScene
// ─────────────────────────────────────────────────
export default function BoxScene({ flashMsg }) {
  const controlsRef = useRef()
  const autoRotate  = useStore(s => s.autoRotate)
  const srcImg      = useStore(s => s.srcImg)
  const isLoading   = useStore(s => s.isLoading)
  const showFlash   = useStore(s => s.showFlash)
  const fileRef     = useRef()

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    useStore.setState({ isLoading: true, fileName: file.name })
    const img = new Image()
    img.onload = () => {
      const detected   = autoDetectCrops(img)
      const finalCrops = detected ? { ...DEFAULT_CROPS, ...detected } : { ...DEFAULT_CROPS }
      const texs       = {}
      for (const [face, f] of Object.entries(finalCrops)) {
        const c = cropToCanvas(img, f); if (c) texs[face] = c
      }
      useStore.setState({ srcImg: img, crops: finalCrops, textures: texs, isLoading: false })
      showFlash(detected ? '✅ Avtomatik aniqlandi!' : "ℹ️ Qo'lda sozlang", 2500)
    }
    img.onerror = () => { useStore.setState({ isLoading: false }); showFlash('❌ Rasm yuklanmadi', 2000) }
    img.src = URL.createObjectURL(file)
  }

  return (
    <div style={{ flex:1, position:'relative', background:'#07050a' }}>
      <Canvas
        shadows
        camera={{ position:[3.2, 2, 3.8], fov:42, near:0.1, far:100 }}
        gl={{ preserveDrawingBuffer:true, alpha:true, antialias:true }}
        onCreated={({ gl }) => {
          gl.toneMapping         = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.35
          gl.outputColorSpace    = THREE.SRGBColorSpace
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        }}
      >
        <SceneSync />
        <EnvMap />
        <BoxMesh />
        <OrbitControls
          ref={controlsRef}
          autoRotate={autoRotate}
          autoRotateSpeed={1.4}
          enableDamping dampingFactor={0.06}
          makeDefault
        />
        <FovSync />
        <CameraRig controlsRef={controlsRef} />
        <ScreenshotHandler controlsRef={controlsRef} />
      </Canvas>

      {/* Upload overlay */}
      {!srcImg && !isLoading && (
        <div
          style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',
            justifyContent:'center',background:'rgba(5,3,8,.93)',zIndex:10,
            flexDirection:'column',gap:14 }}
          onDrop={e=>{e.preventDefault();loadFile(e.dataTransfer.files[0])}}
          onDragOver={e=>e.preventDefault()}
        >
          <DropBox onClick={()=>fileRef.current.click()} />
          <button className="btn-gold" style={{width:'auto',padding:'10px 28px',fontSize:13}}
            onClick={()=>fileRef.current.click()}>
            Rasm tanlash
          </button>
          <span style={{fontSize:11,color:'#605020'}}>
            Yoki{' '}
            <span style={{color:'#c8a040',cursor:'pointer'}} onClick={()=>{
              const store = useStore.getState()
              runDemo(store); showFlash('Demo rejim',2000)
            }}>Demo ko'rish</span>
          </span>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
            onChange={e=>{loadFile(e.target.files[0]);e.target.value=''}} />
        </div>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div style={{
          position:'absolute',inset:0,display:'flex',alignItems:'center',
          justifyContent:'center',background:'rgba(5,3,8,.85)',zIndex:20,
          flexDirection:'column',gap:12,
        }}>
          <div style={{
            width:44,height:44,borderRadius:'50%',
            border:'3px solid #3a2800',
            borderTopColor:'#e8c050',
            animation:'spin 0.9s linear infinite',
          }}/>
          <span style={{fontSize:12,color:'#a08030'}}>Tahlil qilinmoqda...</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {flashMsg && <div className="flash">{flashMsg}</div>}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────
function DropBox({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        border:`2px dashed ${hov?'#e8c050':'#9a7020'}`, borderRadius:14,
        padding:'28px 48px', textAlign:'center', cursor:'pointer', transition:'all .25s',
        background: hov?'rgba(50,34,0,.8)':'rgba(20,14,0,.7)',
      }}>
      <div style={{fontSize:36,marginBottom:8}}>📦</div>
      <h2 style={{fontSize:16,color:'#d8b040',marginBottom:5}}>Dieline / Shablon yuklang</h2>
      <p style={{color:'#907030',fontSize:12,lineHeight:1.5}}>
        Karobkaning yoyilma shablonini<br/>bu yerga tashlang yoki tanlang
      </p>
    </div>
  )
}

// BG restore helper (screenshot dan keyin)
function restoreBg(gl, bgMode, customBgColor) {
  if (bgMode === 'custom') {
    const col = parseInt(customBgColor.replace('#',''), 16)
    gl.setClearColor(col, 1)
  } else {
    const bg = BG_PRESETS.find(p => p.id === bgMode)
    if (bg?.threeColor != null) gl.setClearColor(bg.threeColor, 1)
  }
}

function runDemo(store) {
  function mk(w, h, fn) {
    const c = document.createElement('canvas'); c.width=w; c.height=h
    fn(c.getContext('2d'),w,h); return c
  }
  const front = mk(512,300,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,'#faf3e0'); g.addColorStop(1,'#ecdda0')
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h)
    const rg=ctx.createRadialGradient(w*.65,h*.55,5,w*.65,h*.5,h)
    rg.addColorStop(0,'rgba(195,148,18,.6)'); rg.addColorStop(1,'rgba(195,148,18,0)')
    ctx.fillStyle=rg; ctx.beginPath(); ctx.ellipse(w*.64,h*.52,w*.36,h*.5,.3,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#9a6c08'; ctx.font=`bold ${h*.27}px Georgia`; ctx.fillText('3D BOX',w*.05,h*.6)
    ctx.fillStyle='#111'; ctx.font=`bold ${h*.09}px Inter`; ctx.fillText('Demo View',w*.07,h*.76)
    ctx.fillStyle='#111'; ctx.font=`${h*.08}px Inter`; ctx.fillText('SAMPLE',w*.67,h*.12)
    ctx.strokeStyle='#9a6c08'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.arc(w*.82,h*.46,h*.25,0,Math.PI*2); ctx.stroke()
  })
  const back = mk(512,300,(ctx,w,h)=>{
    ctx.fillStyle='#f5edcf'; ctx.fillRect(0,0,w,h)
    ctx.fillStyle='#3a2400'; ctx.font=`bold ${h*.07}px Inter`; ctx.fillText('Back panel / Orqa',w*.04,h*.09)
    ctx.fillStyle='#222'; ctx.font=`${h*.053}px Inter`
    ["Ingredient 1 – 150mg","Ingredient 2 – 80mg","Ingredient 3 – 80mg","Ingredient 4 – 80mg"]
    .forEach((t,i)=>ctx.fillText(t,w*.04,h*.19+i*h*.11))
  })
  const side = mk(210,300,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,w,0); g.addColorStop(0,'#c8a030'); g.addColorStop(1,'#e0b840')
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h)
    ctx.save(); ctx.translate(w/2,h/2); ctx.rotate(-Math.PI/2)
    ctx.fillStyle='rgba(80,40,0,.7)'; ctx.font=`bold ${w*.22}px Georgia`
    ctx.textAlign='center'; ctx.fillText('3D BOX VIEW',0,8); ctx.restore()
  })
  const top = mk(512,65,(ctx,w,h)=>{
    ctx.fillStyle='#f0e8c0'; ctx.fillRect(0,0,w,h)
    ctx.fillStyle='#705010'; ctx.font=`bold ${h*.38}px Inter`
    ctx.fillText('3D BOX VIEW  ·  Sample Product  ·  Demo',w*.02,h*.72)
  })
  const bot = mk(512,190,(ctx,w,h)=>{
    ctx.fillStyle='#e4d890'; ctx.fillRect(0,0,w,h)
    ctx.fillStyle='rgba(120,80,10,.15)'; ctx.font='bold 12px Georgia'
    for(let x=0;x<w;x+=86) for(let y=0;y<h;y+=28) ctx.fillText('3D BOX VIEW',x,y+12)
  })
  const fakeImg = new Image(); fakeImg.src = front.toDataURL()
  fakeImg.onload = () => store.setSrcImg(fakeImg)
  store.setAllTextures({ front, back, left:side, right:side, top, bottom:bot })
}

const easeInOut = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t
const delay = ms => new Promise(r => setTimeout(r, ms))
