const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8769);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t,{pct=1.2,sc=null,hash=''}={}){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'))`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(sc&&u.includes('/data/selfcheck.json'))return ro.fulfill({contentType:'application/json',body:JSON.stringify(sc)});
   if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[70000,pct,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:U.pathname=='/news'?{t:'10:00',at:t,n:3,items:[{src:'CNBC',title:'Nvidia rallies',ko:'엔비디아 급등',link:'https://e.com/1',ts:t},{src:'CNBC',title:'Fed holds rates',ko:'연준 금리 동결',link:'https://e.com/2',ts:t},{src:'WSJ',title:'Oil jumps',ko:'유가 급등',link:'https://e.com/3',ts:t}]}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8769/kospi-radar/'+hash);await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);const P=[pg];
 // 21 chart lines
 await pg.evaluate(()=>{const c=CUR;LS.s('goat_alert',{'KR:005930':{m:'KR',c:'005930',n:'삼성전자',up:null,dn:null}})});
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2000);
 const mid=await pg.evaluate(()=>{const B=window.__CB;const v=Math.round((Math.max(...B.map(b=>b[2]))+Math.min(...B.map(b=>b[3])))/2);LS.s('goat_alert',{'KR:005930':{m:'KR',c:'005930',n:'삼성전자',up:v,dn:1}});drawChart();return v});
 const ln=await pg.evaluate(()=>[...document.querySelectorAll('#chart text')].map(t=>t.textContent).filter(t=>t.includes('알림')));
 ok('제21회 범위 안 알림가 선 표시·범위 밖은 생략',ln.length==1&&ln[0].includes('알림 ↑'),JSON.stringify(ln));
 // 22 bar click
 const box=await pg.$('#chart svg');const bb=await box.boundingBox();await pg.mouse.click(bb.x+bb.width-3,bb.y+60);await pg.waitForTimeout(300);
 const bi=await pg.evaluate(()=>({t:document.getElementById('barinfo').innerText,last:window.__CB.at(-1)}));ok('제22회 마지막 봉 누르면 그날 값',bi.t.includes(bi.last[0])&&bi.t.includes('종 '+Number(bi.last[4]).toLocaleString('en-US').split('.')[0]),bi.t);
 await pg.mouse.move(bb.x+200,bb.y+60);await pg.mouse.down();await pg.mouse.move(bb.x+120,bb.y+60,{steps:5});await pg.mouse.up();ok('제22회 끌기(이동)는 정보창 안 바뀜',await pg.evaluate(t=>document.getElementById('barinfo').innerText==t,bi.t));
 // 23 move alert
 const p2=await page(T,{pct:6.3});P.push(p2);await p2.evaluate(()=>{LS.s('goat_watch',[{m:'KR',c:'005930',n:'삼성전자'}])});await p2.evaluate(()=>moveTick());await p2.waitForTimeout(800);
 const t1=await p2.evaluate(()=>(document.getElementById('toast')||{}).textContent||'');ok('제23회 관심종목 +6.3% 급등 알림',t1.includes('삼성전자')&&t1.includes('+6.3%'),t1);
 await p2.evaluate(()=>{document.getElementById('toast').textContent=''});await p2.evaluate(()=>moveTick());await p2.waitForTimeout(500);ok('제23회 같은 날 두 번 안 울림',await p2.evaluate(()=>document.getElementById('toast').textContent==''));
 const p3=await page(T,{pct:3.1});P.push(p3);await p3.evaluate(()=>{LS.s('goat_watch',[{m:'KR',c:'005930',n:'삼성전자'}])});await p3.evaluate(()=>moveTick());await p3.waitForTimeout(500);ok('제23회 ±5% 미만은 안 울림',await p3.evaluate(()=>!(document.getElementById('toast')||{}).textContent));
 // 24 KRW
 await pg.evaluate(()=>go('stock',{code:'NVDA',m:'US'}));await pg.waitForTimeout(2500);const kw=await pg.evaluate(async()=>{const g=await J('data/KR/global.json');const r=g.find(x=>x.symbol=='KRW=X');const px=CUR.signal.close??CUR.bars.at(-1)[4];return{t:document.getElementById('krwv').innerText,exp:Math.round(px*r.close).toLocaleString('en-US')}});
 ok('제24회 미국 종목 원화 환산',kw.t.includes(kw.exp+'원'),JSON.stringify(kw));
 // 25 shortcuts
 const p4=await page(T,{hash:'#v=find'});P.push(p4);ok('제25회 #v=find 바로가기',await p4.evaluate(()=>VIEW=='find'));
 const man=JSON.parse(fs.readFileSync(ROOT+'/manifest.json','utf8'));ok('제25회 manifest 바로가기 3개',(man.shortcuts||[]).length==3&&man.shortcuts.every(x=>/^\.\/#v=(find|paper|news)$/.test(x.url)));
 // 26 news search
 await pg.evaluate(()=>go('news'));await pg.waitForTimeout(2500);await pg.fill('#nq','급등');await pg.waitForTimeout(300);
 const nv=await pg.evaluate(()=>[...document.querySelectorAll('#nl > a')].filter(a=>a.style.display!='none').length);ok('제26회 뉴스 검색 "급등" → 2건',nv==2&&(await pg.innerText('#nfc')).includes('2건'),String(nv));
 await pg.click('#nseg button:nth-child(2)');await pg.waitForTimeout(400);await pg.click('#nseg button:nth-child(1)');await pg.waitForTimeout(400);ok('제26회 탭 바꿔도 검색 유지',await pg.evaluate(()=>[...document.querySelectorAll('#nl > a')].filter(a=>a.style.display!='none').length)==2);
 // 28/29 selfcheck
 const META=JSON.parse(require('fs').readFileSync(require('path').join(ROOT,'data/meta.json'),'utf8'));const bad={at:'2026-11-12 17:40',ok:false,n:2,fails:['KR 종목 수 부족 900 < 1000','data/US/radar.json 없음'],asof:{KR:META.KR.asof,US:META.US.asof}};
 const p5=await page(T,{sc:bad});P.push(p5);await p5.waitForTimeout(1000);const b5=await p5.evaluate(()=>(document.getElementById('staleb')||{}).innerText||'');ok('제28회 자가점검 실패 시 경고 띠',b5.includes('자동 점검 문제 2건')&&b5.includes('종목 수 부족'),b5);
 await p5.evaluate(()=>go('score'));await p5.waitForTimeout(2500);const s5=await p5.innerText('#view');ok('제29회 성적표에 자가점검 상세',s5.includes('문제 2건')&&s5.includes('radar.json 없음'));
 const good={...bad,ok:true,n:0,fails:[]};const p6=await page(T,{sc:good});P.push(p6);await p6.waitForTimeout(800);ok('제28회 이상 없으면 띠 없음',await p6.evaluate(()=>!document.getElementById('staleb')));
 await p6.evaluate(()=>go('score'));await p6.waitForTimeout(2500);ok('제29회 이상 없음 표시',(await p6.innerText('#view')).includes('이상 없음'));
 const old={...bad,asof:{KR:'2026-11-10'}};const p7=await page(T,{sc:old});P.push(p7);await p7.waitForTimeout(800);ok('제28회 지난 날짜 점검 결과로는 경고 안 함',await p7.evaluate(()=>!document.getElementById('staleb')));
 // 30 retry
 await pg.evaluate(()=>go('stock',{code:'ZZZZZZ',m:'KR'}));await pg.waitForTimeout(1500);const rt=await pg.$('#view button.pill');ok('제30회 실패 화면에 다시 시도 버튼',rt&&(await rt.innerText())=='다시 시도');
 await pg.route('**/data/KR/ZZZZZZ.json',ro=>ro.fulfill({contentType:'application/json',body:fs.readFileSync(ROOT+'/data/KR/005930.json')}));await rt.click();await pg.waitForTimeout(2000);ok('제30회 다시 시도하면 열림',await pg.evaluate(()=>!!document.getElementById('chart')));
 for(const p of P)ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
