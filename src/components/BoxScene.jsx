import { useRef, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import useStore, { BG_PRESETS, computeBoxDims } from '../store'
import { loadFile } from '../utils/loadFile'
import { runDemo } from '../utils/demo'

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
  const prevMats = useRef([]) // P4.3: deferred disposal

  const materials = useMemo(() => {
    // P4.7: anisotropy tekshiruvi — renderer mavjud bo'lmasa default 8
    const maxAniso = 8

    return FACE_ORDER.map(face => {
      const canvas = textures[face]
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace      = THREE.SRGBColorSpace
        tex.anisotropy      = maxAniso
        tex.generateMipmaps = true
        tex.minFilter       = THREE.LinearMipmapLinearFilter
        tex.magFilter       = THREE.LinearFilter
        tex.needsUpdate     = true
        return new THREE.MeshPhysicalMaterial({
          map: tex,
          roughness: 0.9,
          metalness: 0,
          clearcoat: 0.35,
          clearcoatRoughness: 0.15,
          envMapIntensity: envI * 0.3,
        })
      }
      return new THREE.MeshPhysicalMaterial({
        color: DEFAULT_COLORS[face],
        roughness: 0.7,
        metalness: 0,
        clearcoat: 0.2,
        clearcoatRoughness: 0.2,
        envMapIntensity: envI * 0.4,
      })
    })
  }, [textures, envI])

  // P4.3: Deferred material disposal — eski materiallarni keyingi siklda tozalash
  useEffect(() => {
    const old = prevMats.current
    prevMats.current = materials
    return () => {
      old.forEach(m => {
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
  const envPreset    = useStore(s => s.envPreset)
  const envIntensity = useStore(s => s.envIntensity)
  const { scene }    = useThree()

  useEffect(() => {
    scene.environmentIntensity = envIntensity * 0.25
  }, [envIntensity, scene])

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
// Anisotropy runtime check
// ─────────────────────────────────────────────────
function AnisoCheck() {
  const { gl } = useThree()
  useEffect(() => {
    // Store max anisotropy for BoxMesh to use
    window.__maxAniso = gl.capabilities.getMaxAnisotropy?.() || 8
  }, [gl])
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
// Screenshot handler — P1.6: kamera tiklash + P4.4: dynamic JSZip
// ─────────────────────────────────────────────────
function ScreenshotHandler({ controlsRef }) {
  const { gl, scene, camera, size } = useThree()
  const shotRequest  = useStore(s => s.shotRequest)
  const clearShotReq = useStore(s => s.clearShotRequest)
  const bgMode       = useStore(s => s.bgMode)
  const customBgColor = useStore(s => s.customBgColor)
  const showFlash    = useStore(s => s.showFlash)
  const busyRef      = useRef(false)

  // P4.8: useRef pattern — stale closure muammosini oldini olish
  const stateRef = useRef({ bgMode, customBgColor })
  stateRef.current = { bgMode, customBgColor }

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

    const mimeType = fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png'
    const q        = fmt === 'png' ? 1.0 : 0.94
    const ext      = fmt === 'jpg' ? 'jpg' : fmt === 'webp' ? 'webp' : 'png'
    const url      = gl.domElement.toDataURL(mimeType, q)

    gl.setSize(ow, oh); gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    camera.aspect = ow / oh; camera.updateProjectionMatrix()
    if (transparent) {
      scene.background = origBg; scene.fog = origFog
      restoreBg(gl, stateRef.current.bgMode, stateRef.current.customBgColor)
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

      // P1.6 FIX: Asl kamera holatini saqlash
      const savedPos = camera.position.clone()
      const savedTarget = controlsRef.current?.target?.clone() || new THREE.Vector3(0,0,0)

      ;(async () => {
        // P4.4: Dynamic JSZip import
        const JSZip = (await import('jszip')).default
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
          const base64 = url.split(',')[1]
          folder.file(name, base64, { base64: true })
          await delay(60)
        }

        // P1.6 FIX: Kamerani asl holatiga qaytarish
        camera.position.copy(savedPos)
        camera.lookAt(savedTarget)
        if (controlsRef.current) {
          controlsRef.current.target.copy(savedTarget)
          controlsRef.current.update()
        }

        showFlash('ZIP tayyorlanmoqda...', 1500)
        const blob = await zip.generateAsync({ type: 'blob' })
        const a = document.createElement('a')
        a.download = `3d-box-view_${quality/1024}K_all6.zip`
        a.href = URL.createObjectURL(blob)
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
        showFlash(`Barcha 6 rakurs ZIP (${quality/1024}K) saqlandi!`, 3000)
        busyRef.current = false; clearShotReq()
      })()
    } else {
      const az = Math.round((Math.atan2(camera.position.x, camera.position.z) * 180/Math.PI + 360) % 360)
      const { url, ext, name } = takeOne(quality, transparent, `az${az}`, fmt)
      const a = document.createElement('a')
      a.download = name; a.href = url; a.click()
      showFlash(`Saqlandi! (${quality/1024}K · ${fmt.toUpperCase()} · ${quality}×${Math.round(quality/(size.width/size.height))}px)`, 2500)
      busyRef.current = false; clearShotReq()
    }
  }, [shotRequest])

  return null
}

// ─────────────────────────────────────────────────
// Background + Lights + Shadow plane
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

  const az  = lightAzimuth  * Math.PI / 180
  const el  = lightElevation * Math.PI / 180
  const R   = 6
  const lx  = R * Math.cos(el) * Math.sin(az)
  const ly  = R * Math.sin(el)
  const lz  = R * Math.cos(el) * Math.cos(az)

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
      <ambientLight color={ambientColor} intensity={brightness * ambientIntensity} />
      <directionalLight
        color={lightColor}
        intensity={brightness * lightIntensity}
        position={[lx, ly, lz]}
        castShadow={shadowOn}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.001}
      />
      {rimLight && (
        <directionalLight
          color={rimColor}
          intensity={brightness * rimIntensity}
          position={[rx, ry, rz]}
        />
      )}
      <directionalLight color="#ffd080" intensity={brightness * 0.08} position={[0, -3, -4]} />
      <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[0, shadowY, 0]}>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={shadowOpacity} />
      </mesh>
    </>
  )
}

// ─────────────────────────────────────────────────
// Main BoxScene — P2.5: drag-and-drop vizual signal
// ─────────────────────────────────────────────────
export default function BoxScene({ flashMsg, flashFading }) {
  const controlsRef = useRef()
  const autoRotate  = useStore(s => s.autoRotate)
  const srcImg      = useStore(s => s.srcImg)
  const isLoading   = useStore(s => s.isLoading)
  const showFlash   = useStore(s => s.showFlash)
  const fileRef     = useRef()
  const [isDragOver, setDragOver] = useState(false)

  return (
    <div style={{ flex:1, position:'relative', background:'var(--bg-base)' }}>
      <Canvas
        shadows
        camera={{ position:[3.2, 2, 3.8], fov:42, near:0.1, far:100 }}
        gl={{ preserveDrawingBuffer:true, alpha:true, antialias:true }}
        onCreated={({ gl }) => {
          gl.toneMapping         = THREE.NeutralToneMapping
          gl.toneMappingExposure = 1.0
          gl.outputColorSpace    = THREE.SRGBColorSpace
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        }}
      >
        <SceneSync />
        <EnvMap />
        <BoxMesh />
        <AnisoCheck />
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
          style={{
            position:'absolute',inset:0,display:'flex',alignItems:'center',
            justifyContent:'center',background:'rgba(8,8,14,.93)',zIndex:10,
            flexDirection:'column',gap:14,
            transition:'border-color .2s',
          }}
          onDrop={e=>{e.preventDefault();setDragOver(false);loadFile(e.dataTransfer.files[0])}}
          onDragOver={e=>{e.preventDefault();setDragOver(true)}}
          onDragLeave={()=>setDragOver(false)}
        >
          {/* P2.5: Drag-over vizual signal */}
          {isDragOver && (
            <div style={{
              position:'absolute',inset:16,border:'2px dashed var(--accent)',
              borderRadius:16,background:'rgba(108,138,255,.06)',
              display:'flex',alignItems:'center',justifyContent:'center',
              zIndex:2,
            }}>
              <span style={{fontSize:16,color:'var(--accent)',fontWeight:600}}>Tashlang!</span>
            </div>
          )}

          <DropBox onClick={()=>fileRef.current.click()} />
          <button className="btn-primary" style={{width:'auto',padding:'10px 28px',fontSize:13}}
            onClick={()=>fileRef.current.click()}>
            Rasm tanlash
          </button>
          <span style={{fontSize:11,color:'var(--text-tertiary)'}}>
            Yoki{' '}
            <span style={{color:'var(--accent)',cursor:'pointer'}} onClick={()=>{
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
          justifyContent:'center',background:'rgba(8,8,14,.85)',zIndex:20,
          flexDirection:'column',gap:12,
        }}>
          <div style={{
            width:44,height:44,borderRadius:'50%',
            border:'3px solid #222230',
            borderTopColor:'var(--accent)',
            animation:'spin 0.9s linear infinite',
          }}/>
          <span style={{fontSize:12,color:'var(--text-secondary)'}}>Tahlil qilinmoqda...</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* P2.2: Flash with fade-out */}
      {flashMsg && (
        <div className="flash" style={{
          opacity: flashFading ? 0 : 1,
          transition: 'opacity .25s ease',
        }}>{flashMsg}</div>
      )}
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
        border:`2px dashed ${hov?'var(--accent)':'#333348'}`, borderRadius:16,
        padding:'32px 52px', textAlign:'center', cursor:'pointer', transition:'all .25s',
        background: hov?'rgba(108,138,255,.06)':'rgba(20,20,30,.7)',
      }}>
      <div style={{fontSize:32,marginBottom:10,color:'var(--text-tertiary)',opacity:0.4}}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
        </svg>
      </div>
      <h2 style={{fontSize:15,color:'var(--text-primary)',marginBottom:5,fontWeight:600}}>Shablon yuklang</h2>
      <p style={{color:'var(--text-tertiary)',fontSize:11,lineHeight:1.6}}>
        Karobkaning yoyilma shablonini<br/>bu yerga tashlang yoki tanlang
      </p>
    </div>
  )
}

function restoreBg(gl, bgMode, customBgColor) {
  if (bgMode === 'custom') {
    const col = parseInt(customBgColor.replace('#',''), 16)
    gl.setClearColor(col, 1)
  } else {
    const bg = BG_PRESETS.find(p => p.id === bgMode)
    if (bg?.threeColor != null) gl.setClearColor(bg.threeColor, 1)
  }
}

const easeInOut = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t
const delay = ms => new Promise(r => setTimeout(r, ms))
