const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8768);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900},permissions:['clipboard-read','clipboard-write']});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'))`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[12345,2.5,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8768/kospi-radar/');await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);
 // 11 US movers
 await pg.evaluate(()=>go('us'));await pg.waitForTimeout(3000);await pg.evaluate(()=>{SEG='상승률';usList()});await pg.waitForTimeout(1500);
 const u1=await pg.evaluate(()=>{const ix=[...document.querySelectorAll('#ulist .row')].map(e=>e.getAttribute('onclick').match(/code:'([^']+)'/)[1]);return ix});
 const chk=await pg.evaluate(async c=>{const d=await J('data/US/index.json');const m=new Map(d.rows.map(r=>[r[0],r]));const p=c.map(x=>m.get(x)[5]);return {sorted:p.every((x,i)=>!i||p[i-1]>=x),liq:c.every(x=>m.get(x)[8]>=1e7),n:c.length,top:p[0]}},u1);
 ok('제11회 미국 상승률 상위 정렬·거래대금 하한',chk.sorted&&chk.liq&&chk.n>5,JSON.stringify(chk));
 // 12 US heatmap
 const h=await pg.evaluate(()=>{const t=document.querySelectorAll('.hmt');return{n:t.length,head:document.querySelector('.hm h3').innerText}});ok('제12회 미국 시장 지도',h.n==40&&h.head.includes('미국'),JSON.stringify(h));
 await pg.evaluate(()=>{document.querySelector('.hm').open=true;document.querySelector('.hmt').click()});await pg.waitForTimeout(1500);ok('제12회 미국 지도 → 미국 종목 화면',await pg.evaluate(()=>VIEW=='stock'&&CUR.m=='US'));
 // 13 watch live
 await pg.evaluate(()=>{LS.s('goat_watch',[{m:'KR',c:'005930',n:'삼성전자'}]);go('find')});await pg.waitForTimeout(2000);
 const wl=await pg.evaluate(()=>(document.querySelector('[data-wl="KR"]')||{}).innerText||'');ok('제13회 관심종목 실시간 가격(장중)',wl.includes('12,345')&&wl.includes('실시간'),wl);
 // 14 compare
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2000);
 await pg.evaluate(()=>{document.querySelector('.cmp').open=true;document.getElementById('cmpq').value='하이닉스';});await pg.evaluate(()=>cmpDraw());await pg.waitForTimeout(1200);
 const cm=await pg.evaluate(async()=>{const t=document.getElementById('cmpc').innerText;const d2=await J('data/KR/000660.json');const A=CUR.bars.slice(-125),M=new Map(d2.bars.map(b=>[b[0],b[4]]));const P=A.filter(b=>M.has(b[0]));const exp=((M.get(P.at(-1)[0])/M.get(P[0][0])-1)*100).toFixed(1);return{t,exp,paths:document.querySelectorAll('#cmpc path').length}});
 ok('제14회 비교 차트(부분 이름 하이닉스) 수익률 맞음',cm.paths==2&&cm.t.includes('SK하이닉스')&&cm.t.includes(cm.exp+'%'),JSON.stringify(cm).slice(0,200));
 await pg.evaluate(()=>{document.getElementById('cmpq').value='ㅎㄷㅊ'});await pg.evaluate(()=>cmpDraw());await pg.waitForTimeout(1200);ok('제14회 초성 ㅎㄷㅊ → 현대차 비교',await pg.evaluate(()=>document.getElementById('cmpc').innerText.includes('현대차')));
 await pg.evaluate(()=>{document.getElementById('cmpq').value='없는종목zz'});await pg.evaluate(()=>cmpDraw());await pg.waitForTimeout(600);ok('제14회 없는 종목 안내',await pg.evaluate(()=>document.getElementById('cmpc').innerText.includes('넣어 주세요')));
 // 16 memo
 await pg.evaluate(()=>{document.querySelector('.memo').open=true});await pg.fill('#memot','실적 발표 후 재검토');await pg.waitForTimeout(200);
 await pg.evaluate(()=>go('kr'));await pg.waitForTimeout(1500);await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2000);
 ok('제16회 메모 저장·다시 열면 보임',await pg.evaluate(()=>document.getElementById('memot').value=='실적 발표 후 재검토'&&document.querySelector('.memo').open));
 // 15 '/' key
 await pg.evaluate(()=>document.activeElement.blur());await pg.keyboard.press('/');await pg.waitForTimeout(1500);ok('제15회 / 키 → 검색',await pg.evaluate(()=>VIEW=='find'));
 await pg.fill('#q','/삼성');ok('제15회 입력창에서는 / 그대로 입력',await pg.evaluate(()=>document.getElementById('q').value.startsWith('/')));
 // 17 font size
 await pg.click('button[aria-label="글자 크기 바꾸기"]');ok('제17회 글자 110%',await pg.evaluate(()=>document.body.style.zoom=='1.1'));
 await pg.click('button[aria-label="글자 크기 바꾸기"]');await pg.click('button[aria-label="글자 크기 바꾸기"]');ok('제17회 120% 다음 기본으로',await pg.evaluate(()=>document.body.style.zoom==''));
 // 18 brief
 await pg.evaluate(()=>go('kr'));await pg.waitForTimeout(3000);const bf=await pg.evaluate(async()=>{const t=(document.querySelector('.brief')||{}).innerText||'';const ix=await J('data/KR/index.json');return{t,b:ix.rows.filter(x=>x[3]=='추세 강세').length,w:ix.rows.filter(x=>x[3]=='추세 약세').length}});
 ok('제18회 오늘의 요약 숫자 맞음',bf.t.includes(`추세 강세 ${bf.b}개`)&&bf.t.includes(`추세 약세 ${bf.w}개`)&&bf.t.includes('시장 국면'),bf.t.slice(0,200));
 // 19 backup/restore
 const code=await pg.evaluate(()=>{LS.s('goat_memo',{'KR:005930':'메모A'});return bkCode()});
 const pg2=await page(T);const rs=await pg2.evaluate(c=>{const a=bkRestore(c);return[a,wList().length,LS.g('goat_memo',{})['KR:005930']]},code);ok('제19회 백업 코드로 새 기기 복원',rs[0]&&rs[1]==1&&rs[2]=='메모A',JSON.stringify(rs));
 ok('제19회 잘못된 코드 거부',await pg2.evaluate(()=>bkRestore('GS1.xxx')===false&&bkRestore('hello')===false));
 // 20 session countdown — 3 times
 const s1=await pg.evaluate(()=>document.getElementById('sessl').innerText);ok('제20회 10:00 → 장 마감까지 5시간 30분',s1.includes('장 마감까지 5시간 30분'),s1);
 const pg3=await page(Date.parse('2026-11-19T09:20:00+09:00'));const s2=await pg3.evaluate(()=>document.getElementById('sessl').innerText);ok('제20회 수능일 09:20 → 시작까지 40분',s2.includes('장 시작까지 40분'),s2);
 const pg4=await page(Date.parse('2026-11-14T12:00:00+09:00'));const s3=await pg4.evaluate(()=>document.getElementById('sessl').innerText);ok('제20회 토요일 → 다음 장 11/16(월) 09:00',s3.includes('다음 장 11/16(월) 09:00'),s3);
 for(const p of [pg,pg2,pg3,pg4])ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
