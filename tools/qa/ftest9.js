const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8776);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t,{pct=1.2,sc=null,hash='',tour=false}={}){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));${tour?'':"localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'));"}`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(sc&&u.includes('/data/selfcheck.json'))return ro.fulfill({contentType:'application/json',body:JSON.stringify(sc)});
   if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[70000,pct,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:U.pathname=='/news'?{t:'10:00',at:t,n:3,items:[{src:'CNBC',title:'Nvidia rallies',ko:'엔비디아 급등',link:'https://e.com/1',ts:t},{src:'CNBC',title:'Fed holds rates',ko:'연준 금리 동결',link:'https://e.com/2',ts:t},{src:'WSJ',title:'Oil jumps',ko:'유가 급등',link:'https://e.com/3',ts:t}]}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8776/kospi-radar/'+hash);await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);const P=[pg];pg.on('dialog',d=>d.accept());
 // 81
 await pg.evaluate(()=>go('macro'));await pg.waitForTimeout(2500);const ec=await pg.evaluate(()=>[...document.querySelectorAll('.ecal')].map(e=>e.innerText.replace(/\n/g,' ')));
 ok('제81회 경제 일정: 11-13 기준 첫 줄 수능일 D-6, 8개',ec.length==8&&ec[0].startsWith('D-6')&&ec[0].includes('수능일'),ec.slice(0,3).join(' | '));
 ok('제81회 FOMC 한국시각 12/10(목) 04:00 D-27',ec.some(t=>t.includes('D-27')&&t.includes('12/10(목) 04:00')&&t.includes('FOMC')),ec.find(t=>t.includes('FOMC')));
 const p9=await page(Date.parse('2026-12-10T12:00:00+09:00'));P.push(p9);const e9=await p9.evaluate(()=>ecalUp(3).map(e=>dday(e[0])+' '+e[3]));ok('제81회 12/10 정오: FOMC는 오늘(지난 시각 포함)·CPI 오늘',e9[0]=='오늘 FOMC 금리 결정(04:30 기자회견)'&&e9[1].startsWith('오늘 미국 11월 소비자물가'),e9.join('|'));
 // 82
 await pg.evaluate(()=>go('kr'));await pg.waitForTimeout(3000);const nb=await pg.evaluate(()=>[...document.querySelectorAll('.sessl')].map(e=>e.innerText).join('|'));ok('제82회 첫 화면 다음 큰 일정',nb.includes('다음 큰 일정: 🇺🇸 미국 11월 고용보고서 · 12/4(금) 22:30 (D-21)'),nb);
 // 83 focus-visible
 await pg.keyboard.press('Tab');await pg.keyboard.press('Tab');const fv=await pg.evaluate(()=>{const e=document.activeElement;const cs=getComputedStyle(e);return{tag:e.tagName,ol:cs.outlineStyle,w:cs.outlineWidth}});ok('제83회 키보드 이동 시 초점 테두리',fv.ol=='solid'&&parseFloat(fv.w)>=2,JSON.stringify(fv));
 // 85 runlog via route
 const RL=fs.readFileSync(require('path').join(__dirname,'runlog_sample.json'),'utf8');const p2=await page(T);P.push(p2);await p2.route('**/data/KR/runlog.json',ro=>ro.fulfill({contentType:'application/json',body:RL}));await p2.evaluate(()=>go('score'));await p2.waitForTimeout(3000);
 const rl=await p2.evaluate(()=>document.getElementById('view').textContent);ok('제85회 자동 작업 기록: 3단계 중 1단계 실패·실패 내용',rl.includes('3단계 중 1단계 실패')&&rl.includes('세계 시장 실패: timeout'),'');
 await pg.route('**/data/KR/runlog.json',ro=>ro.fulfill({status:404,body:''}));await pg.evaluate(()=>{delete CACHE['data/KR/runlog.json'];go('score')});await pg.waitForTimeout(3000);await pg.unroute('**/data/KR/runlog.json');ok('제85회 기록이 없으면 카드 안 보임(가짜 자료 없음)',!(await pg.innerText('#view')).includes('자동 작업 기록'));
 // 86 MA toggles
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2500);const n0=await pg.evaluate(()=>document.querySelectorAll('#chart svg polyline').length);await pg.click('.indt button:nth-child(3)');await pg.waitForTimeout(300);
 const n1=await pg.evaluate(()=>({n:document.querySelectorAll('#chart svg polyline').length,s:LS.g('goat_ind',{}).ma60,leg:[...document.querySelectorAll('.indt button.on')].map(b=>b.textContent)}));ok('제86회 60이평 끄기(선 1개 줄고 기억)',n1.n==n0-1&&n1.s===0&&!n1.leg.includes('60이평'),JSON.stringify({n0,n1}));
 await pg.click('.indt button:nth-child(3)');await pg.waitForTimeout(200);
 // 87 recent chips
 await pg.evaluate(()=>go('stock',{code:'000660',m:'KR'}));await pg.waitForTimeout(2000);const rc=await pg.evaluate(()=>[...document.querySelectorAll('#view .qch button')].map(b=>b.textContent));ok('제87회 최근 본 다른 종목(자기 제외)',rc.includes('🕘 삼성전자')&&!rc.some(t=>t.includes('SK하이닉스')),rc.join('|'));
 // 88 marks
 await pg.evaluate(()=>{LS.s('goat_watch',[{m:'KR',c:'000660',n:'SK하이닉스'}]);LS.s('goat_memo',{'KR:000660':'x'});go('kr')});await pg.waitForTimeout(3000);await pg.evaluate(()=>{SEG='시총';krList()});await pg.waitForTimeout(1500);
 const mk=await pg.evaluate(()=>{const r=[...document.querySelectorAll('#klist .row')].find(e=>e.getAttribute('onclick').includes("'000660'"));return r?r.querySelector('.nm b').innerText:''});ok('제88회 목록에 ★·📝',mk.includes('★')&&mk.includes('📝'),mk);
 // 89 grade in paper
 await pg.evaluate(()=>{const P=pLoad('KR');P.pos={'005930':{n:1,avg:60000,name:'삼성전자'}};pSave(P,'KR');go('paper')});await pg.waitForTimeout(2500);const gd=await pg.evaluate(async()=>{const ix=await J('data/KR/index.json');const r=ix.rows.find(x=>x[0]=='005930');const pr=[...document.querySelectorAll('.pr')].find(e=>e.innerText.includes('삼성전자'));return{t:pr?pr.querySelector('.pr1 b').innerText:'',g:r[3],s:Math.round(r[2])}});
 ok('제89회 모의 보유 종목에 등급·점수',gd.t.includes(gd.g)&&gd.t.includes(String(gd.s)),JSON.stringify(gd));
 // 90 preload
 const c9=await br.newContext({serviceWorkers:'block'});await c9.addInitScript(`localStorage.setItem('gs_trial_start',String(Date.now()));localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'))`);await c9.route('**/*',r=>r.request().url().startsWith('http://localhost')?r.continue():r.abort());
 const pp=await c9.newPage();pp.errs=[];pp.on('pageerror',e=>pp.errs.push(e.message));const rq=[];pp.on('request',r=>{if(r.url().includes('data/KR/index.json'))rq.push(r.resourceType())});await pp.goto('http://localhost:8776/kospi-radar/');await pp.waitForTimeout(2500);P.push(pp);
 ok('제90회 첫 화면 자료 미리 받기(preload로 먼저 받고 다시 안 받음)',rq.length==1,JSON.stringify(rq));
 for(const p of P)ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
