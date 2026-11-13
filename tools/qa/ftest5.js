const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8772);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t,{pct=1.2,sc=null,hash='',tour=false}={}){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));${tour?'':"localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'));"}`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(sc&&u.includes('/data/selfcheck.json'))return ro.fulfill({contentType:'application/json',body:JSON.stringify(sc)});
   if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[70000,pct,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:U.pathname=='/news'?{t:'10:00',at:t,n:3,items:[{src:'CNBC',title:'Nvidia rallies',ko:'엔비디아 급등',link:'https://e.com/1',ts:t},{src:'CNBC',title:'Fed holds rates',ko:'연준 금리 동결',link:'https://e.com/2',ts:t},{src:'WSJ',title:'Oil jumps',ko:'유가 급등',link:'https://e.com/3',ts:t}]}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8772/kospi-radar/'+hash);await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);const P=[pg];const G=JSON.parse(fs.readFileSync(ROOT+'/data/KR/gaplog.json','utf8'));
 // 42
 await pg.evaluate(()=>go('score'));await pg.waitForTimeout(2500);const sv=await pg.innerText('#view');
 const hit=Math.round(G.rows.filter(r=>(r[2]>0)==(r[3]>0)).length/G.rows.length*100);
 ok('제42회 성적표 학습 기록 카드(적중률 다시 계산해 대조)',sv.includes('매일 다시 배우는 기록')&&sv.includes(G.hit+'%')&&hit==G.hit,`표시 ${G.hit} 재계산 ${hit}`);
 ok('제42회 막대·점 30쌍',await pg.evaluate(n=>document.querySelectorAll('svg[aria-label="시초가 예상과 실제 비교"] rect').length==n&&document.querySelectorAll('svg[aria-label="시초가 예상과 실제 비교"] circle').length==n,G.rows.length));
 const miss=G.rows.filter(r=>(r[2]>0)!=(r[3]>0)).length;ok('제42회 방향 틀린 날 주황 점 수',await pg.evaluate(()=>[...document.querySelectorAll('svg[aria-label="시초가 예상과 실제 비교"] circle')].filter(c=>c.getAttribute('fill')=='#F59E0B').length)==miss,String(miss));
 // 42 warn when low
 await pg.route('**/data/KR/gaplog.json',ro=>ro.fulfill({contentType:'application/json',body:JSON.stringify({...G,hit:48})}));
 const p2=await page(T);P.push(p2);await p2.route('**/data/KR/gaplog.json',ro=>ro.fulfill({contentType:'application/json',body:JSON.stringify({...G,hit:48})}));await p2.evaluate(()=>{GAPLOG=null;delete CACHE['data/KR/gaplog.json'];go('score')});await p2.waitForTimeout(2500);ok('제42회 적중 55% 미만이면 경고',(await p2.innerText('#view')).includes('55% 아래'));
 // 43/44
 await pg.unroute('**/data/KR/gaplog.json');await pg.evaluate(()=>{GAPLOG=null;go('kr')});await pg.waitForTimeout(3500);const uc=await pg.evaluate(()=>(document.querySelector('#uscard .gapp em')||{}).innerText||'');
 ok('제43·44회 미장 카드에 실제 적중·오차 폭',uc.includes(`최근 ${G.n}일 실제 적중 ${G.hit}%`)&&uc.includes(`±${G.mae}%p 빗나감`),uc);
 // 48 brief
 ok('제48회 오늘의 요약에 시초가 성적',(await pg.innerText('.brief')).includes(`방향 ${G.hit}% 맞혔습니다`));
 // 45 glossary
 await pg.evaluate(()=>go('score'));await pg.waitForTimeout(2500);await pg.evaluate(()=>document.querySelector('.glc').open=true);await pg.fill('.glc input','갭');await pg.waitForTimeout(200);const gl=await pg.innerText('#gll');ok('제45회 용어 사전 검색 "갭"',gl.includes('시초가 갭')&&!gl.includes('VIX'),gl.slice(0,60));
 // 50 toc
 const toc=await pg.evaluate(()=>[...document.querySelectorAll('#stoc button')].map(b=>b.textContent));ok('제50회 성적표 목차',toc.length>=3&&toc.some(t=>t.includes('시초가'))&&toc.some(t=>t.includes('용어')),toc.join('|'));
 await pg.evaluate(()=>{window.scrollTo(0,0);[...document.querySelectorAll('#stoc button')].find(b=>b.textContent.includes('용어')).click()});await pg.waitForTimeout(1000);const pos=await pg.evaluate(()=>[document.querySelector('.glc').getBoundingClientRect().top,scrollY,document.body.scrollHeight,innerHeight]);ok('제50회 목차 누르면 그 위치로(맨 아래면 끝까지)',(pos[0]<200&&pos[0]>-50)||pos[1]>=pos[2]-pos[3]-2,JSON.stringify(pos));
 // 46 tour
 const p3=await page(T,{tour:true});P.push(p3);await p3.waitForTimeout(1500);ok('제46회 처음 열면 안내 1/4',(await p3.innerText('#tour')).includes('1 / 4'));
 for(let k=0;k<4;k++){await p3.click('#tnext');await p3.waitForTimeout(150)}ok('제46회 끝까지 넘기면 닫힘·다시 안 뜸',await p3.evaluate(()=>!document.getElementById('tour')&&LS.g('goat_tour',0)==1));
 await p3.reload();await p3.waitForTimeout(2500);ok('제46회 다시 열어도 안 뜸',await p3.evaluate(()=>!document.getElementById('tour')));
 // 49 alert list
 await pg.evaluate(()=>{LS.s('goat_alert',{'KR:005930':{m:'KR',c:'005930',n:'삼성전자',up:80000,dn:60000}});go('find')});await pg.waitForTimeout(1500);const al=await pg.innerText('#sr');ok('제49회 켜 둔 알림 목록',al.includes('켜 둔 가격 알림 1')&&al.includes('80,000원 이상')&&al.includes('60,000원 이하'),al.slice(0,120));
 await pg.click('text=끄기');await pg.waitForTimeout(300);ok('제49회 끄기',await pg.evaluate(()=>!Object.keys(LS.g('goat_alert',{})).length&&!document.getElementById('sr').innerText.includes('켜 둔 가격 알림')));
 for(const p of P)ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
