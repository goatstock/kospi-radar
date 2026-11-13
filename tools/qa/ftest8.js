const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8775);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t,{pct=1.2,sc=null,hash='',tour=false}={}){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));${tour?'':"localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'));"}`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(sc&&u.includes('/data/selfcheck.json'))return ro.fulfill({contentType:'application/json',body:JSON.stringify(sc)});
   if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[70000,pct,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:U.pathname=='/news'?{t:'10:00',at:t,n:3,items:[{src:'CNBC',title:'Nvidia rallies',ko:'엔비디아 급등',link:'https://e.com/1',ts:t},{src:'CNBC',title:'Fed holds rates',ko:'연준 금리 동결',link:'https://e.com/2',ts:t},{src:'WSJ',title:'Oil jumps',ko:'유가 급등',link:'https://e.com/3',ts:t}]}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8775/kospi-radar/'+hash);await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);const P=[pg];pg.on('dialog',d=>d.accept());const CP=JSON.parse(fs.readFileSync(ROOT+'/data/KR/caps.json','utf8'));const IX=JSON.parse(fs.readFileSync(ROOT+'/data/KR/index.json','utf8'));
 const kq=new Set(IX.rows.filter(r=>r[9]=='KOSDAQ').map(r=>r[0]));const ordA=Object.entries(CP.cap).filter(([k])=>!kq.has(k)).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
 // 72
 await pg.evaluate(()=>go('stock',{code:'000660',m:'KR'}));await pg.waitForTimeout(2500);const cv=await pg.evaluate(()=>(document.getElementById('capv')||{}).innerText||'');
 ok('제72회 SK하이닉스 시총·코스피 순위',cv.includes('코스피 '+(ordA.indexOf('000660')+1)+'위')&&cv.includes('조원'),cv);
 // 73
 await pg.evaluate(()=>go('kr'));await pg.waitForTimeout(3000);await pg.evaluate(()=>{SEG='시총';krList()});await pg.waitForTimeout(1500);const top=await pg.evaluate(()=>[...document.querySelectorAll('#klist .row')].slice(0,5).map(e=>e.getAttribute('onclick').match(/code:'([^']+)'/)[1]));
 const allOrd=Object.entries(CP.cap).filter(([k])=>IX.rows.some(r=>r[0]==k)).sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,5);ok('제73회 시총 상위 5개 순서',JSON.stringify(top)==JSON.stringify(allOrd),JSON.stringify(top)+' vs '+JSON.stringify(allOrd));
 // 74
 await pg.evaluate(()=>{document.querySelector(".hm[data-m='KR']").open=true});await pg.evaluate(()=>hmSwitch('시가총액'));await pg.waitForTimeout(800);const hm=await pg.evaluate(()=>({first:document.querySelector(".hm[data-m='KR'] .hmt b").textContent,h:document.querySelector(".hm[data-m='KR'] h3").innerText,saved:LS.g('goat_hmby','')}));
 const big=IX.rows.find(r=>r[0]==allOrd[0])[1];ok('제74회 지도 칸 크기 시가총액(첫 칸 = 시총 1위)·설정 기억',hm.first==big&&hm.h.includes('시가총액 상위 40')&&hm.saved=='시가총액',JSON.stringify(hm));
 await pg.evaluate(()=>hmSwitch('거래대금'));
 // 75 thermo
 const th=await pg.evaluate(async()=>{const r=await J('data/regime.json'),gl=await J('data/KR/global.json'),ix=await J('data/KR/index.json');return{t:(document.querySelector('.thermo')||{}).innerText||'',r,vix:(gl.find(x=>x.symbol=='^VIX')||{}).close,p:ix.rows.map(x=>x[5]).filter(x=>x!=null)}});
 const parts=[];const v=th.vix;if(v!=null)parts.push(v<=13?90:v<=16?70:v<=20?50:v<=28?30:10);const ur=th.p.filter(x=>x>0).length/th.p.length*100;parts.push(ur);const d=(th.r.kospi/th.r.ma20-1)*100;parts.push(Math.max(0,Math.min(100,50+d*10)));parts.push(Math.max(0,Math.min(100,50+th.r.foreign5/400)));const exp=Math.round(parts.reduce((a,b)=>a+b,0)/parts.length);
 ok('제75회 시장 온도 값 재계산 일치',th.t.includes(exp+'°'),`표시 ${th.t.slice(0,40)} / 재계산 ${exp}`);
 // 76/77
 await pg.evaluate(()=>go('score'));await pg.waitForTimeout(3000);const ab=await pg.innerText('#view');ok('제76회 자료 출처·앱 버전',ab.includes('자료 출처·갱신')&&ab.includes('개선 100회'));
 await pg.context().grantPermissions(['clipboard-read','clipboard-write']);await pg.evaluate(()=>{LS.s('goat_memo',{'KR:005930':'비밀메모'});window.dispatchEvent(new ErrorEvent('error',{message:'테스트오류X'}))});await pg.click('text=문제 신고 내용 복사');await pg.waitForTimeout(400);const dg=await pg.evaluate(()=>navigator.clipboard.readText());
 ok('제77회 진단 내용(버전·화면·오류 포함, 메모 없음)',dg.includes('개선 100회')&&dg.includes('화면 score')&&dg.includes('테스트오류X')&&!dg.includes('비밀메모'),dg.slice(0,200));
 // 79 % alert
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2500);await pg.click('text=지금보다 ±5%');await pg.waitForTimeout(200);const al=await pg.evaluate(()=>({u:$('#alUp').value,d:$('#alDn').value,c:CUR.signal.close??CUR.bars.at(-1)[4]}));
 ok('제79회 ±5% 알림가 자동 입력',+al.u==Math.round(al.c*1.05)&&+al.d==Math.round(al.c*0.95),JSON.stringify(al));
 // 78 new version banner: simulate controllerchange with prior controller
 const p2=await page(T);P.push(p2);await p2.evaluate(()=>newVer());const nv=await p2.evaluate(()=>(document.getElementById('newv')||{}).innerText||'');await p2.evaluate(()=>newVer());
 ok('제78회 새 버전 안내 띠(한 번만)·새로 고침 버튼',nv.includes('새 버전이 준비됐습니다')&&nv.includes('새로 고침')&&await p2.evaluate(()=>document.querySelectorAll('#newv').length==1),nv);
 ok('제78회 첫 설치 때는 안 띄우고 업데이트 때만(코드 조건 확인)',fs.readFileSync(ROOT+'/index.html','utf8').includes('addEventListener("controllerchange",()=>{if(had)newVer()})'));
 // 80 search shows cap
 await pg.evaluate(()=>go('find'));await pg.waitForTimeout(1500);await pg.fill('#q','삼성전자');await pg.waitForTimeout(500);const sr=await pg.evaluate(()=>document.querySelector('#sr .row .nm span').innerText);ok('제80회 검색 결과에 시가총액',/시총 [\d,.]+조/.test(sr),sr);
 for(const p of P)ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
