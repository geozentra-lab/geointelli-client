const { chromium } = require('playwright');
const W = 1440, H = 900, BASE = 'http://localhost:4200';
const cursorJs = `
window.addEventListener('DOMContentLoaded', () => {
  const c = document.createElement('div');
  c.id='__cursor';
  Object.assign(c.style,{position:'fixed',left:'0',top:'0',width:'22px',height:'22px',borderRadius:'50%',
    background:'rgba(201,120,60,.35)',border:'2px solid #c9783c',zIndex:2147483647,pointerEvents:'none',
    transform:'translate(-50%,-50%)',transition:'width .15s,height .15s'});
  document.body.appendChild(c);
  document.addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';},true);
  document.addEventListener('mousedown',()=>{c.style.width='14px';c.style.height='14px';},true);
  document.addEventListener('mouseup',()=>{c.style.width='22px';c.style.height='22px';},true);
});`;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:W,height:H}, recordVideo:{dir:'rec',size:{width:W,height:H}} });
  await ctx.addInitScript(cursorJs); await ctx.route(/localhost:8081|notification-api/, () => {});
  const p = await ctx.newPage(); const T0=Date.now();
  let pos = {x:W/2,y:H/2};
  const moveTo = async (loc) => { await loc.waitFor({state:'visible',timeout:8000}); await loc.scrollIntoViewIfNeeded(); const bb = await loc.boundingBox(); const t={x:bb.x+bb.width/2,y:bb.y+bb.height/2};
    await p.mouse.move(t.x,t.y,{steps:25}); pos=t; await p.waitForTimeout(250); };
  const click = async (loc) => { await moveTo(loc); await p.mouse.down(); await p.mouse.up(); };
  const nav = (t) => p.locator('aside, nav').getByText(t, {exact:true}).first();

  await p.goto(BASE+'/dashboard',{waitUntil:'load'}); await p.getByText('Your property workspace').waitFor(); await p.waitForTimeout(400); require('fs').writeFileSync('start.txt',String((Date.now()-T0)/1000)); await p.mouse.move(pos.x,pos.y);
  await p.waitForTimeout(1500);
  for (const t of ['Opportunities','Compare','Portfolio']) { await moveTo(nav(t)); await p.waitForTimeout(300); }
  await moveTo(p.getByText('Compare properties').first()); await p.waitForTimeout(800);
  await moveTo(p.getByText('Research properties').first()); await p.waitForTimeout(800);

  // Map
  await click(nav('Explore properties')); await p.waitForTimeout(1800);
  await click(p.getByText('Parcel search',{exact:true}).first()); await p.locator('.leaflet-container').first().waitFor(); await p.waitForTimeout(2200);
  await click(p.getByRole('button',{name:'Address',exact:true}));
  const input = p.locator('input[type=text], input:not([type])').filter({hasNot:p.locator('[disabled]')}).nth(0);
  const search = p.locator('input[placeholder*="ddress" i]').first();
  const target = (await search.count()) ? search : input;
  await click(target); await target.pressSequentially('1200 Brickell Ave, Miami', {delay:70});
  await p.waitForTimeout(900);
  await click(p.locator('.leaflet-container').first()); await p.waitForTimeout(500);
    const map = p.locator('.leaflet-container').first(); const mb = await map.boundingBox();
  const cx = mb.x+mb.width*0.68, cy = Math.min(mb.y+mb.height*0.3, H-120);
  await p.mouse.move(cx,cy,{steps:25});
  for (let i=0;i<3;i++){ await p.mouse.wheel(0,-240); await p.waitForTimeout(1600); }
  await p.mouse.down(); await p.mouse.move(cx-200,cy-60,{steps:40}); await p.mouse.up(); await p.waitForTimeout(2000);
  pos={x:cx-250,y:cy+80};

  // Investment studio
  await click(nav('Investment studio')); await p.waitForTimeout(1500);
  const fields = [['Purchase price','650000'],['Down payment','130000'],['Annual interest rate','6.25'],['Annual property tax','9800'],['Annual home insurance','3200']];
  for (const [l,v] of fields) { const f=p.getByText(l,{exact:false}).locator('visible=true').first().locator('xpath=following::input[1]'); await click(f); await f.pressSequentially(v,{delay:60}); await p.waitForTimeout(200); }
  await moveTo(p.getByRole('button',{name:'Calculate'})); await p.waitForTimeout(800);
  await click(p.getByText('Affordability',{exact:true}).first()); await p.waitForTimeout(2000);
  await click(nav('Overview')); await p.mouse.move(W*0.55,H*0.4,{steps:30}); await p.waitForTimeout(2500);
  await ctx.close(); await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
