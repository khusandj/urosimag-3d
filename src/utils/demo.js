/**
 * Demo rejim — sahte texture yaratib karobkani ko'rsatadi
 */
export function runDemo(store) {
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
    ;["Ingredient 1 – 150mg","Ingredient 2 – 80mg","Ingredient 3 – 80mg","Ingredient 4 – 80mg"]
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
