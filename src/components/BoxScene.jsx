import { useRef, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import useStore, { BG_PRESETS, computeBoxDims } from '../store'

// ─────────────────────────────────────────────────
// BoxMesh — CanvasTexture (sinxron, cho'zilish yo'q)
// ─────────────────────────────────────────────────
const FACE_ORDER = ['right', 'left', 'top', 'bottom', 'front', 'back']
const DEFAULT_COLORS = {
  right: 0xcca840, left: 0xcca840, top: 0xf0e0b8,
  bottom: 0x5a4008, front: 0xf5eccc, back: 0xcca840,
}

function BoxMesh() {
  const textures  = useStore(s => s.textures)
  const srcImg    = useStore(s => s.srcImg)
  const crops     = useStore(s => s.crops)
  const boxScale  = useStore(s => s.boxScale)
  const envI      = useStore(s => s.envIntensity)
  const meshRef   = useRef()

  // Materiallar — CanvasTexture sinxron, async flash yo'q
  const materials = useMemo(() => {
    return FACE_ORDER.map(face => {
      const canvas = textures[face]
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace    = THREE.SRGBColorSpace
        tex.anisotropy    = 16
        tex.generateMipmaps   = true
        tex.minFilter     = THREE.LinearMipmapLinearFilter
        tex.magFilter     = THREE.LinearFilter
        tex.needsUpdate   = true
        return new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.15, metalness: 0.04, envMapIntensity: envI,
        })
      }
      return new THREE.MeshStandardMaterial({
        color: DEFAULT_COLORS[face], roughness: 0.28, metalness: 0.04,
      })
    })
  }, [textures, envI])   // textures o'zgarganda — SINXRON yangilanadi

  // Box o'lchamlari crop nisbatlaridan (buzilish yo'q)
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
// Camera tween (OrbitControls bilan to'g'ri ishlaydi)
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
// Screenshot handler
// ─────────────────────────────────────────────────
function ScreenshotHandler() {
  const { gl, scene, camera, size } = useThree()
  const shotRequest    = useStore(s => s.shotRequest)
  const clearShotReq   = useStore(s => s.clearShotRequest)
  const bgMode         = useStore(s => s.bgMode)
  const showFlash      = useStore(s => s.showFlash)
  const busyRef        = useRef(false)

  const takeOne = async (quality, transparent, name) => {
    const ow = size.width, oh = size.height
    const nw = quality, nh = Math.round(quality / (ow / oh))
    const origBg = scene.background, origFog = scene.fog

    gl.setSize(nw, nh); gl.setPixelRatio(1)
    camera.aspect = nw / nh; camera.updateProjectionMatrix()

    if (transparent) { scene.background = null; scene.fog = null; gl.setClearColor(0x000000, 0) }

    gl.render(scene, camera)
    const url = gl.domElement.toDataURL('image/png', 1.0)

    gl.setSize(ow, oh); gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    camera.aspect = ow / oh; camera.updateProjectionMatrix()
    if (transparent) {
      scene.background = origBg; scene.fog = origFog
      const bg = BG_PRESETS.find(p => p.id === bgMode)
      if (bg?.threeColor != null) gl.setClearColor(bg.threeColor, 1)
    }
    gl.render(scene, camera)

    const a = document.createElement('a')
    a.download = `urosimag_${quality/1024}K_${name}${transparent ? '_transparent' : ''}.png`
    a.href = url; a.click()
  }

  useEffect(() => {
    if (!shotRequest || busyRef.current) return
    busyRef.current = true
    const { quality, transparent, views } = shotRequest

    if (views === 'all') {
      const ALL = [
        {n:'front',p:[0,0,4.5]},{n:'back',p:[0,0,-4.5]},
        {n:'left',p:[-4.5,0,0]},{n:'right',p:[4.5,0,0]},
        {n:'top',p:[0,6,.01]},{n:'iso',p:[3.2,2,3.8]},
      ];
      (async () => {
        for (let i = 0; i < ALL.length; i++) {
          const v = ALL[i]
          showFlash(`${v.n} saqlanyapti... (${i+1}/6)`, 1200)
          camera.position.set(...v.p); camera.lookAt(0,0,0)
          await delay(120)
          await takeOne(quality, transparent, v.n)
          await delay(260)
        }
        showFlash(`Barcha 6 rakurs (${quality/1024}K) saqlandi!`, 2500)
        busyRef.current = false; clearShotReq()
      })()
    } else {
      const az = Math.round((Math.atan2(camera.position.x, camera.position.z) * 180/Math.PI + 360) % 360);
      (async () => {
        await takeOne(quality, transparent, `az${az}`)
        showFlash(`Saqlandi! (${quality/1024}K · ${quality}×${Math.round(quality/(size.width/size.height))}px)`, 2500)
        busyRef.current = false; clearShotReq()
      })()
    }
  }, [shotRequest])

  return null
}

// ─────────────────────────────────────────────────
// Background + Lights sync
// ─────────────────────────────────────────────────
function SceneSync() {
  const bgMode    = useStore(s => s.bgMode)
  const brightness = useStore(s => s.brightness)
  const shadowOn  = useStore(s => s.shadowEnabled)
  const { scene, gl } = useThree()

  useEffect(() => {
    const p = BG_PRESETS.find(b => b.id === bgMode)
    if (!p) return
    if (p.threeColor == null) {
      scene.background = null; scene.fog = null; gl.setClearColor(0,0)
    } else {
      const c = new THREE.Color(p.threeColor)
      scene.background = c; scene.fog = new THREE.Fog(c, 8, 22); gl.setClearColor(c, 1)
    }
  }, [bgMode])

  useEffect(() => { gl.shadowMap.enabled = shadowOn }, [shadowOn])

  return (
    <>
      <ambientLight color="#fff5d0" intensity={brightness * 0.55} />
      <directionalLight
        color="#fff0c0" intensity={brightness * 2.8}
        position={[3,5,4]} castShadow={shadowOn}
        shadow-mapSize={[2048,2048]} shadow-bias={-0.001}
      />
      <directionalLight color="#c0d0ff" intensity={brightness*0.7} position={[-3,2,-2]} />
      <directionalLight color="#ffd080" intensity={brightness*0.35} position={[0,-3,-4]} />
      {/* Shadow plane */}
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-0.55,0]}>
        <planeGeometry args={[20,20]} />
        <shadowMaterial opacity={0.18} />
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
  const showFlash   = useStore(s => s.showFlash)
  const store       = useStore()
  const fileRef     = useRef()

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    import('../utils/autoDetect').then(({ autoDetectCrops }) => {
      const img = new Image()
      img.onload = () => {
        store.setSrcImg(img)
        const detected = autoDetectCrops(img)
        if (detected) Object.entries(detected).forEach(([f, c]) => {
          // crops ni to'g'ridan set qilib keyin refreshAll
          store.crops[f] = c
        })
        // Barcha crops set bo'lgandan keyin atomik refresh
        const finalCrops = detected
          ? { ...store.crops, ...detected }
          : store.crops
        import('../store').then(({ cropToCanvas }) => {
          const texs = {}
          for (const [face, f] of Object.entries(finalCrops)) {
            const c = cropToCanvas(img, f); if (c) texs[face] = c
          }
          useStore.setState({ crops: finalCrops, textures: texs })
          showFlash(detected ? 'Avtomatik aniqlandi!' : "Qo'lda sozlang", 2000)
        })
      }
      img.src = URL.createObjectURL(file)
    })
  }

  return (
    <div style={{ flex:1, position:'relative', background:'#07050a' }}>
      <Canvas
        shadows
        camera={{ position:[3.2,2,3.8], fov:42, near:0.1, far:100 }}
        gl={{ preserveDrawingBuffer:true, alpha:true, antialias:true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.3
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.setPixelRatio(Math.min(window.devicePixelRatio,2))
        }}
      >
        <SceneSync />
        <BoxMesh />
        <OrbitControls
          ref={controlsRef}
          autoRotate={autoRotate}
          autoRotateSpeed={1.4}
          enableDamping dampingFactor={0.06}
          makeDefault
        />
        <CameraRig controlsRef={controlsRef} />
        <ScreenshotHandler />
      </Canvas>

      {/* Upload overlay */}
      {!srcImg && (
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
              runDemo(store); showFlash('Demo rejim',2000)
            }}>Demo ko'rish</span>
          </span>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
            onChange={e=>{loadFile(e.target.files[0]);e.target.value=''}} />
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

function runDemo(store) {
  function mk(w, h, fn) {
    const c = document.createElement('canvas'); c.width=w; c.height=h
    fn(c.getContext('2d'),w,h); return c   // canvas qaytariladi (DataURL emas)
  }
  const front = mk(512,300,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,'#faf3e0'); g.addColorStop(1,'#ecdda0')
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h)
    const rg=ctx.createRadialGradient(w*.65,h*.55,5,w*.65,h*.5,h)
    rg.addColorStop(0,'rgba(195,148,18,.6)'); rg.addColorStop(1,'rgba(195,148,18,0)')
    ctx.fillStyle=rg; ctx.beginPath(); ctx.ellipse(w*.64,h*.52,w*.36,h*.5,.3,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#9a6c08'; ctx.font=`bold ${h*.27}px Georgia`; ctx.fillText('UROSIMAG',w*.05,h*.6)
    ctx.fillStyle='#111'; ctx.font=`bold ${h*.09}px Inter`; ctx.fillText('Asia pharm',w*.07,h*.76)
    ctx.fillStyle='#111'; ctx.font=`${h*.08}px Inter`; ctx.fillText('30 KAPSULA',w*.67,h*.12)
    ctx.strokeStyle='#9a6c08'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.arc(w*.82,h*.46,h*.25,0,Math.PI*2); ctx.stroke()
  })
  const back = mk(512,300,(ctx,w,h)=>{
    ctx.fillStyle='#f5edcf'; ctx.fillRect(0,0,w,h)
    ctx.fillStyle='#3a2400'; ctx.font=`bold ${h*.07}px Inter`; ctx.fillText('Tarkibi / Состав',w*.04,h*.09)
    ctx.fillStyle='#222'; ctx.font=`${h*.053}px Inter`
    ["Magniy sitrat – 150mg","Toloknyanka – 80mg","Kukuruza gultoji – 80mg","Ortosifon – 80mg",
     "Chernika – 60mg","Qoqio't – 40mg","Momaqaymoq – 40mg","Xvosh – 40mg"]
    .forEach((t,i)=>ctx.fillText(t,w*.04,h*.19+i*h*.088))
  })
  const side = mk(210,300,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,w,0); g.addColorStop(0,'#c8a030'); g.addColorStop(1,'#e0b840')
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h)
    ctx.save(); ctx.translate(w/2,h/2); ctx.rotate(-Math.PI/2)
    ctx.fillStyle='rgba(80,40,0,.7)'; ctx.font=`bold ${w*.22}px Georgia`
    ctx.textAlign='center'; ctx.fillText('УРОЦИМАГ',0,8); ctx.restore()
  })
  const top = mk(512,65,(ctx,w,h)=>{
    ctx.fillStyle='#f0e8c0'; ctx.fillRect(0,0,w,h)
    ctx.fillStyle='#705010'; ctx.font=`bold ${h*.38}px Inter`
    ctx.fillText('UROSIMAG  ·  Asia pharm  ·  30 KAPSULA',w*.02,h*.72)
  })
  const bot = mk(512,190,(ctx,w,h)=>{
    ctx.fillStyle='#e4d890'; ctx.fillRect(0,0,w,h)
    ctx.fillStyle='rgba(120,80,10,.15)'; ctx.font='bold 12px Georgia'
    for(let x=0;x<w;x+=86) for(let y=0;y<h;y+=28) ctx.fillText('UROSIMAG',x,y+12)
  })
  const fakeImg = new Image(); fakeImg.src = front.toDataURL()
  fakeImg.onload = () => store.setSrcImg(fakeImg)
  store.setAllTextures({ front, back, left:side, right:side, top, bottom:bot })
}

const easeInOut = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t
const delay = ms => new Promise(r => setTimeout(r, ms))
