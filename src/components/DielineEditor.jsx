import { useRef, useEffect, useCallback } from 'react'
import useStore, { FACE_META, computeBoxDims, cropToCanvas } from '../store'
import { autoDetectCrops } from '../utils/autoDetect'

const HR = 7 // handle radius px

export default function DielineEditor() {
  const canvasRef = useRef(null)
  const wrapRef   = useRef(null)
  const dragRef   = useRef(null)
  const fileRef   = useRef(null)

  const srcImg         = useStore(s => s.srcImg)
  const crops          = useStore(s => s.crops)
  const selectedFace   = useStore(s => s.selectedFace)
  const boxScale       = useStore(s => s.boxScale)
  const setCropAndRefresh = useStore(s => s.setCropAndRefresh)
  const setSelectedFace   = useStore(s => s.setSelectedFace)
  const setSrcImg         = useStore(s => s.setSrcImg)
  const showFlash         = useStore(s => s.showFlash)

  // ── Draw ──────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return
    const cw = wrap.clientWidth  || 380
    const ch = wrap.clientHeight || 400
    canvas.width = cw; canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, cw, ch)

    if (!srcImg) {
      ctx.fillStyle = '#0e0a02'; ctx.fillRect(0,0,cw,ch)
      ctx.fillStyle = '#4a3010'; ctx.font = '13px Inter, Segoe UI'
      ctx.textAlign = 'center'
      ctx.fillText('Shablon rasmini yuklang', cw/2, ch/2-10)
      ctx.font = '11px Inter'; ctx.fillStyle = '#2a1a00'
      ctx.fillText('yoki buradan sudrang', cw/2, ch/2+12)
      ctx.textAlign = 'left'
      return
    }

    const sc = Math.min(cw/srcImg.naturalWidth, ch/srcImg.naturalHeight)
    const dw = srcImg.naturalWidth * sc, dh = srcImg.naturalHeight * sc
    const ox = (cw-dw)/2,              oy  = (ch-dh)/2
    canvas._m = { ox, oy, dw, dh }

    // Draw dieline image
    ctx.drawImage(srcImg, ox, oy, dw, dh)

    // Compute box dims for annotation
    const dims = computeBoxDims(srcImg, crops, boxScale)

    for (const fm of FACE_META) {
      const f   = crops[fm.id]
      const px  = ox + f.x*dw, py = oy + f.y*dh
      const pw  = f.w*dw,      ph = f.h*dh
      const sel = fm.id === selectedFace

      // Fill overlay
      ctx.fillStyle = fm.color
      ctx.fillRect(px, py, pw, ph)

      // Border
      ctx.strokeStyle = fm.stroke
      ctx.lineWidth   = sel ? 2.5 : 1.5
      ctx.setLineDash(sel ? [] : [4,3])
      ctx.strokeRect(px, py, pw, ph)
      ctx.setLineDash([])

      // Label
      ctx.fillStyle = fm.stroke
      ctx.font = `${sel ? 'bold ' : ''}${sel ? 11 : 9}px Inter, Segoe UI`
      ctx.fillText(fm.label, px+4, py+13)

      // Dimension annotation (har bir face uchun)
      const dimText = getDimText(fm.id, dims)
      if (dimText && pw > 50 && ph > 20) {
        ctx.font = `bold ${Math.min(11, Math.max(8, ph*.13))}px Inter`
        ctx.fillStyle = 'rgba(255,255,255,.9)'
        ctx.strokeStyle = 'rgba(0,0,0,.5)'
        ctx.lineWidth = 2.5
        const tx = px + pw/2, ty = py + ph/2 + 5
        ctx.strokeText(dimText, tx - ctx.measureText(dimText).width/2, ty)
        ctx.fillText(dimText,   tx - ctx.measureText(dimText).width/2, ty)
      }

      // Resize handles (faqat tanlanganida)
      if (sel) drawHandles(ctx, px, py, pw, ph, fm.stroke)
    }

    // Yon o'q ko'rsatkichlari (W, H, D)
    drawArrowAnnotations(ctx, ox, oy, dw, dh, crops, dims)

  }, [srcImg, crops, selectedFace, boxScale])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const ro = new ResizeObserver(draw)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [draw])

  // ── Mouse: handle hits ─────────────────────────
  function getMeta() { return canvasRef.current?._m || null }

  function facePx(fid) {
    const m = getMeta(); if (!m || !srcImg) return null
    const f = crops[fid]
    return { px:m.ox+f.x*m.dw, py:m.oy+f.y*m.dh, pw:f.w*m.dw, ph:f.h*m.dh, ...m }
  }

  function hitHandle(mx, my, p) {
    for (const h of getHPts(p.px,p.py,p.pw,p.ph)) {
      const dx=mx-h.px, dy=my-h.py
      if (dx*dx+dy*dy < (HR+3)*(HR+3)) return h.id
    }
    return null
  }

  function hitFace(mx, my) {
    for (const fm of [...FACE_META].reverse()) {
      const p = facePx(fm.id); if (!p) continue
      if (mx>=p.px && mx<=p.px+p.pw && my>=p.py && my<=p.py+p.ph) return fm.id
    }
    return null
  }

  // ── Drag ──────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (!srcImg) return
    const r  = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX-r.left, my = e.clientY-r.top
    const p  = facePx(selectedFace); if (!p) return
    const hid = hitHandle(mx, my, p)
    if (hid) {
      dragRef.current = { type:'resize', face:selectedFace, hid, sx:mx, sy:my, orig:{...crops[selectedFace]}, meta:p }
      return
    }
    const face = hitFace(mx, my)
    if (face) {
      setSelectedFace(face)
      dragRef.current = { type:'move', face, sx:mx, sy:my, orig:{...crops[face]}, meta:facePx(face) }
    }
  }, [srcImg, crops, selectedFace])

  useEffect(() => {
    const MIN = 0.015
    const onMove = (e) => {
      const d = dragRef.current; if (!d || !srcImg) return
      const r   = canvasRef.current.getBoundingClientRect()
      const mx  = e.clientX-r.left, my = e.clientY-r.top
      const ddx = (mx-d.sx)/d.meta.dw
      const ddy = (my-d.sy)/d.meta.dh
      const o   = d.orig
      let newCrop

      if (d.type === 'move') {
        newCrop = {
          x: Math.max(0, Math.min(1-o.w, o.x+ddx)),
          y: Math.max(0, Math.min(1-o.h, o.y+ddy)),
          w: o.w, h: o.h,
        }
      } else {
        let { x,y,w,h } = { ...o }
        const hd = d.hid
        if (hd.includes('w')) { const nw=w-ddx; if(nw>MIN){x=o.x+ddx;w=nw} }
        if (hd.includes('e')) { w=Math.max(MIN,o.w+ddx) }
        if (hd.includes('n')) { const nh=h-ddy; if(nh>MIN){y=o.y+ddy;h=nh} }
        if (hd.includes('s')) { h=Math.max(MIN,o.h+ddy) }
        newCrop = { x, y, w, h }
      }
      // ATOMIK: crop + texture + dims bir vaqtda yangilanadi
      setCropAndRefresh(d.face, newCrop)
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp) }
  }, [srcImg, setCropAndRefresh])

  const onMouseMove = useCallback((e) => {
    if (dragRef.current || !srcImg) return
    const r  = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX-r.left, my = e.clientY-r.top
    const p  = facePx(selectedFace)
    if (!p) return
    const hid = hitHandle(mx,my,p)
    const CURS = {nw:'nw-resize',n:'n-resize',ne:'ne-resize',e:'e-resize',
                  se:'se-resize',s:'s-resize',sw:'sw-resize',w:'w-resize'}
    canvasRef.current.style.cursor = hid ? (CURS[hid]||'crosshair') : (hitFace(mx,my)?'move':'crosshair')
  }, [srcImg, crops, selectedFace])

  // ── File upload ──────────────────────────────
  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const img = new Image()
    img.onload = () => {
      const detected = autoDetectCrops(img)
      const finalCrops = detected ? { ...crops, ...detected } : crops
      // Textures sinxron yaratamiz
      const texs = {}
      for (const [face, f] of Object.entries(finalCrops)) {
        const c = cropToCanvas(img, f); if (c) texs[face] = c
      }
      useStore.setState({ srcImg: img, crops: finalCrops, textures: texs })
      showFlash(detected ? 'Avtomatik aniqlandi!' : "Qo'lda sozlang", 2000)
    }
    img.src = URL.createObjectURL(file)
  }

  const runAutoDetect = () => {
    if (!srcImg) { showFlash('Avval rasm yuklang!',2000); return }
    const detected = autoDetectCrops(srcImg)
    if (!detected) { showFlash("Aniqlab bo'lmadi",2000); return }
    const finalCrops = { ...crops, ...detected }
    const texs = {}
    for (const [face, f] of Object.entries(finalCrops)) {
      const c = cropToCanvas(srcImg, f); if (c) texs[face] = c
    }
    useStore.setState({ crops: finalCrops, textures: texs })
    showFlash('Avtomatik aniqlandi!', 2000)
  }

  const applyAll = () => {
    if (!srcImg) return
    const texs = {}
    for (const [face, f] of Object.entries(crops)) {
      const c = cropToCanvas(srcImg, f); if (c) texs[face] = c
    }
    useStore.setState({ textures: texs })
    showFlash("3D ga qo'llanildi!", 1800)
  }

  return (
    <div style={{ width:395, background:'var(--bg-panel)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:5, padding:'7px 8px', borderBottom:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center' }}>
        <TBtn primary onClick={()=>fileRef.current.click()}>📁 Yuklash</TBtn>
        <TBtn onClick={runAutoDetect}>🔍 Avtomatik</TBtn>
        <TBtn primary onClick={applyAll} style={{marginLeft:'auto'}}>▶ Qo'llash</TBtn>
      </div>

      {/* Hint */}
      <div style={{ padding:'5px 10px', fontSize:10, color:'#5a3a10', borderBottom:'1px solid #1a1000', background:'#0c0800', flexShrink:0 }}>
        💡 Chiziqlarni tort → karobka o'lchami avtomatik o'zgaradi, rasm buzilmaydi
      </div>

      {/* Canvas */}
      <div
        ref={wrapRef}
        style={{ flex:1, overflow:'hidden', background:'#060400', position:'relative' }}
        onDrop={e=>{e.preventDefault();loadFile(e.dataTransfer.files[0])}}
        onDragOver={e=>e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          style={{ display:'block', width:'100%', height:'100%' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
        />
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:4, padding:'5px 8px', borderTop:'1px solid var(--border)', flexWrap:'wrap', flexShrink:0 }}>
        {FACE_META.map(fm => (
          <div key={fm.id} onClick={()=>setSelectedFace(fm.id)} style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'3px 7px', borderRadius:4, cursor:'pointer',
            border:`1px solid ${fm.id===selectedFace?'#e8c050':fm.stroke+'44'}`,
            background: fm.id===selectedFace?'rgba(255,220,80,.1)':'transparent',
            transition:'all .15s',
          }}>
            <div style={{ width:8, height:8, borderRadius:2, background:fm.stroke, flexShrink:0 }}/>
            <span style={{ fontSize:10, color:fm.stroke }}>{fm.label}</span>
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{loadFile(e.target.files[0]);e.target.value=''}} />
    </div>
  )
}

// ── Toolbar button ─────────────────────────────
function TBtn({ children, onClick, primary, style }) {
  return (
    <button onClick={onClick} style={{
      padding:'5px 9px', borderRadius:5, fontSize:11, cursor:'pointer',
      whiteSpace:'nowrap', transition:'all .15s',
      border: primary?'1px solid #c08020':'1px solid #3a2200',
      background: primary?'linear-gradient(135deg,#a07010,#d8a030)':'rgba(200,150,20,.08)',
      color: primary?'#100800':'#a07030',
      fontWeight: primary?700:400,
      ...style,
    }}>
      {children}
    </button>
  )
}

// ── Canvas helpers ─────────────────────────────
function drawHandles(ctx, px, py, pw, ph, col) {
  for (const h of getHPts(px,py,pw,ph)) {
    ctx.fillStyle='#1a1000'; ctx.beginPath(); ctx.arc(h.px,h.py,HR/2+2,0,Math.PI*2); ctx.fill()
    ctx.fillStyle=col;       ctx.beginPath(); ctx.arc(h.px,h.py,HR/2,  0,Math.PI*2); ctx.fill()
  }
}

function getHPts(px,py,pw,ph) {
  const cx=px+pw/2, cy=py+ph/2, r=px+pw, b=py+ph
  return [
    {id:'nw',px,py},{id:'n',px:cx,py},{id:'ne',px:r,py},
    {id:'e',px:r,py:cy},{id:'se',px:r,py:b},{id:'s',px:cx,py:b},
    {id:'sw',px,py:b},{id:'w',px,py:cy},
  ]
}

function getDimText(faceId, dims) {
  const { wMM, hMM, dMM } = dims
  switch(faceId) {
    case 'front':  return `${wMM}×${hMM}mm`
    case 'back':   return `${wMM}×${hMM}mm`
    case 'left':   return `${dMM}×${hMM}mm`
    case 'right':  return `${dMM}×${hMM}mm`
    case 'top':    return `${wMM}×${dMM}mm`
    case 'bottom': return `${wMM}×${dMM}mm`
    default: return null
  }
}

// Yon o'qlar — W, H, D vizual ko'rsatish
function drawArrowAnnotations(ctx, ox, oy, dw, dh, crops, dims) {
  const { wMM, hMM, dMM } = dims
  const fc = crops.front
  const lc = crops.left

  const fx1 = ox + fc.x * dw
  const fx2 = ox + (fc.x + fc.w) * dw
  const fy1 = oy + fc.y * dh
  const fy2 = oy + (fc.y + fc.h) * dh

  const lx1 = ox + lc.x * dw
  const lx2 = ox + (lc.x + lc.w) * dw

  // W ← → (old yuzning eni)
  drawBrace(ctx, fx1, fy2+6, fx2, fy2+6, `W: ${wMM}mm`, '#3dc85a')
  // H ↑↓ (balandlik)
  drawBrace(ctx, fx2+6, fy1, fx2+6, fy2, `H: ${hMM}mm`, '#3dc85a', true)
  // D (chuqurlik, chap yon kenglik)
  if (lc.w > 0.02) drawBrace(ctx, lx1, fy2+6, lx2, fy2+6, `D: ${dMM}mm`, '#dca020')
}

function drawBrace(ctx, x1, y1, x2, y2, label, col, vertical=false) {
  ctx.save()
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5

  if (!vertical) {
    // horizontal
    ctx.beginPath()
    ctx.moveTo(x1+2,y1); ctx.lineTo(x2-2,y2)
    ctx.moveTo(x1,y1-4); ctx.lineTo(x1,y1+4)
    ctx.moveTo(x2,y2-4); ctx.lineTo(x2,y2+4)
    ctx.stroke()
    ctx.font = 'bold 9px Inter'; ctx.textAlign='center'
    ctx.fillText(label, (x1+x2)/2, y1-5)
  } else {
    // vertical
    ctx.beginPath()
    ctx.moveTo(x1,y1+2); ctx.lineTo(x2,y2-2)
    ctx.moveTo(x1-4,y1); ctx.lineTo(x1+4,y1)
    ctx.moveTo(x2-4,y2); ctx.lineTo(x2+4,y2)
    ctx.stroke()
    ctx.save()
    ctx.translate(x1+14,(y1+y2)/2)
    ctx.rotate(-Math.PI/2)
    ctx.font='bold 9px Inter'; ctx.textAlign='center'
    ctx.fillText(label,0,0)
    ctx.restore()
  }
  ctx.restore()
}
