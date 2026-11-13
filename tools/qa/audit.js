// GOAT STOCK 자체 감사: 로컬 서버 + 가짜 실시간 서버 + 시뮬레이션 시계. 정답(오라클)은 앱과 별도로 계산.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..'),PORT=8765,N=+process.env.N||100,START=+process.env.START||1;
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));
 fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(PORT);
// ---- 오라클 (앱 코드와 독립) ----
const KRH=new Set(["2026-12-25","2026-12-31","2027-01-01"]),KRSP={"2026-11-19":[600,990]};
const USH=new Set(["2026-11-26","2026-12-25","2027-01-01"]),USHALF=new Set(["2026-11-27","2026-12-24"]);
const ymd=d=>d.toISOString().slice(0,10);const addD=(s,n)=>ymd(new Date(Date.parse(s+'T00:00:00Z')+n*864e5));
const wd=s=>new Date(s+'T00:00:00Z').getUTCDay();
const krDay=s=>wd(s)>0&&wd(s)<6&&!KRH.has(s);const usDay=s=>wd(s)>0&&wd(s)<6&&!USH.has(s);
function kst(t){const d=new Date(t+9*36e5);return{day:ymd(d),m:d.getUTCHours()*60+d.getUTCMinutes()}}
function ny(t){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t));const g=k=>p.find(x=>x.type==k).value;return{day:`${g('year')}-${g('month')}-${g('day')}`,m:+g('hour')*60+ +g('minute')}}
function krOpen(t){const k=kst(t);const [a,b]=KRSP[k.day]||[540,930];return krDay(k.day)&&k.m>=a&&k.m<b}
function usOpenO(t){const n=ny(t);return usDay(n.day)&&n.m>=570&&n.m<(USHALF.has(n.day)?780:960)}
function usLastSession(t){const n=ny(t);let d=n.day;if(usDay(d)&&n.m>=570)return d;do{d=addD(d,-1)}while(!usDay(d));return d}
function nyCloseEpoch(d){// 해당 NY 날짜 마감 시각(UTC epoch, 초)
 for(let h=19;h<=22;h++){const t=Date.parse(d+`T${String(h).padStart(2,'0')}:00:00Z`)-(USHALF.has(d)?3*36e5:0);const n=ny(t);if(n.day==d&&n.m==(USHALF.has(d)?780:960))return t/1e3}return Date.parse(d+'T21:00:00Z')/1e3}
function nextKR(s){let d=s;do{d=addD(d,1)}while(!krDay(d));return d}
const MD=s=>{const d=new Date(s+'T00:00:00Z');return `${d.getUTCMonth()+1}/${d.getUTCDate()}(${"일월화수목금토"[d.getUTCDay()]})`};
// ---- 가짜 실시간 서버 ----
function mock(url,t){const u=new URL(url),k=kst(t),T=`${String(Math.floor(k.m/60)).padStart(2,'0')}:${String(k.m%60).padStart(2,'0')}:00`;
 const cs=(u.searchParams.get('c')||u.searchParams.get('s')||'').split(',').filter(Boolean);const r=(i)=>((i*7919)%200-100)/37;
 const live=usOpenO(t),ses=usLastSession(t),ut=live?Math.floor(t/1e3)-60:nyCloseEpoch(ses);
 switch(u.pathname){
 case '/q':return{t:T,p:Object.fromEntries(cs.map((c,i)=>[c,[50000+i*10,r(i+1),krOpen(t)?'OPEN':'CLOSE']]))};
 case '/i':return{t:T,i:{KOSPI:[2650.5,-0.42,krOpen(t)?'OPEN':'CLOSE'],KOSDAQ:[870.1,0.31,krOpen(t)?'OPEN':'CLOSE']}};
 case '/m':return{t:T,b:krOpen(t)?Array.from({length:30},(_,i)=>[`09${String(i).padStart(2,'0')}`,100+i,101+i,99+i,100.5+i,1000*i]):[]};
 case '/fx':{const s=['USDKRW=X','JPYKRW=X','EURKRW=X','CNYKRW=X','GBPKRW=X','HKDKRW=X','TWDKRW=X','AUDKRW=X','CADKRW=X','CHFKRW=X','SGDKRW=X','INRKRW=X','VNDKRW=X','DX-Y.NYB','JPY=X','EURUSD=X','CNH=X','TWD=X','GBPUSD=X'];return{t:T,fx:Object.fromEntries(s.map((x,i)=>[x,[1000+i,r(i),Array.from({length:60},(_,j)=>1000+i+Math.sin(j/5)*10),1100+i,900+i]]))}}
 case '/night':return{t:T,fut:[355.2,-0.3,'CLOSE','2026-11-12T15:45:00+09:00'],'NQ=F':[21000,0.5,ut,20900],'ES=F':[6000,0.2,ut,5990],EWY:[60,-1.1,ut,60.5]};
 case '/uq':return{t:T,p:Object.fromEntries(cs.map((c,i)=>[c,[100+i,r(i+3),ut]]))};
 case '/uh':return{t:T,c:Array.from({length:125},(_,i)=>6000+i*3+Math.sin(i/4)*40)};
 case '/news':return{t:T,at:t,n:3,items:[0,1,2].map(i=>({src:'Reuters',title:'Chipmakers rally '+i,ko:'반도체주 강세 '+i,link:'https://example.com/'+i,ts:t-i*6e5}))};
 }return{ok:true}}
// ---- 회차별 시각: 100개, 서로 다른 날·시각 (12-10 사용기한 전) ----
const FIX=["2026-11-19T09:30:00+09:00","2026-11-19T16:00:00+09:00","2026-11-19T16:40:00+09:00","2026-11-27T02:30:00+09:00","2026-11-27T04:30:00+09:00","2026-11-26T23:45:00+09:00","2026-11-14T03:00:00+09:00","2026-11-16T08:59:00+09:00","2026-11-13T15:31:00+09:00","2026-11-13T23:29:00+09:00","2026-11-13T04:10:00+09:00","2026-11-15T12:00:00+09:00"];
function times(){const a=FIX.map(Date.parse);let t=Date.parse("2026-11-13T00:07:00+09:00");while(a.length<100){t+=(6*60+53)*6e4;if(t>Date.parse("2026-12-10T20:00:00+09:00"))t=Date.parse("2026-11-13T00:07:00+09:00")+a.length*61e4;a.push(t)}return a}
const VIEWS=['kr','us','macro','news','paper','score'];
(async()=>{const br=await chromium.launch();const TS=times();const log=[];let fails=0;
 async function one(i){const t=TS[i];const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}))`);
  await ctx.route('**/*',async ro=>{const u=ro.request().url();if(u.includes('workers.dev'))return ro.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(mock(u,t))});if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));const errs=[];pg.on('pageerror',e=>errs.push('JS오류: '+e.message));
  const iss=[];const k=kst(t);const tag=`${k.day} ${String(Math.floor(k.m/60)).padStart(2,'0')}:${String(k.m%60).padStart(2,'0')} KST`;
  try{await pg.goto(`http://localhost:${PORT}/kospi-radar/`);await pg.waitForTimeout(2500);
   for(const v of VIEWS){await pg.evaluate(v=>go(v),v);await pg.waitForTimeout(v=='kr'?3500:2200);
    const r=await pg.evaluate(()=>{const v=document.getElementById('view'),t=v.innerText,o=[];
     for(const w of ['NaN','undefined','Infinity','[object','null%']){const i=t.indexOf(w);if(i>=0)o.push(`글자오류 "${w}": …${t.slice(Math.max(0,i-30),i+15).replace(/\n/g,' ')}`)}
     v.querySelectorAll('.up,.dn').forEach(e=>{const s=e.innerText.trim();if(e.classList.contains('up')&&/^[-−▼]\s*\d/.test(s))o.push('색오류 빨강인데 하락: '+s.slice(0,25));if(e.classList.contains('dn')&&/^[+▲]\s*\d/.test(s))o.push('색오류 파랑인데 상승: '+s.slice(0,25))});
     v.querySelectorAll('img').forEach(i=>{if(i.complete&&!i.naturalWidth)o.push('그림깨짐 '+i.getAttribute('src'))});
     if(t.trim().length<30)o.push('빈 화면');if(/자료를 불러오지 못했습니다/.test(t))o.push('불러오기 실패: '+t.slice(0,80).replace(/\n/g,' '));
     const uc=document.getElementById('uscard');return{o,us:uc?uc.querySelector('h3').innerText:null,stale:[...document.querySelectorAll('.ixgo')].map(e=>[e.getAttribute('onclick')||'',/실시간/.test((e.querySelector('.ixs')||{}).innerText||'')])}},v);
    r.o.forEach(x=>iss.push(`[${v}] `+x));
    if(v=='kr'){const ko=krOpen(t),uo=usOpenO(t);r.stale.forEach(([oc,st])=>{const isKR=oc.includes("'kr'");const exp=isKR?ko:uo;if(st!==exp)iss.push(`[kr] 지수 타일 장상태 틀림 ${oc.slice(6,30)} 표시=${st?'장중':'마감'} 정답=${exp?'장중':'마감'}`)});if(!r.stale.length)iss.push('[kr] 지수 타일 없음');}
    if(v=='kr'){// 미장 카드 날짜 오라클
     const live=usOpenO(t),ses=usLastSession(t),tg=nextKR(ses),h=r.us||'';
     if(!h)iss.push('[kr] 미장 카드 없음');else{
      if(live&&!h.includes('진행 중'))iss.push(`[kr] 미장 진행 중인데 표시: ${h}`);
      if(!live&&h.includes('진행 중'))iss.push(`[kr] 미장 끝났는데 '진행 중': ${h}`);
      if(!h.includes(MD(ses)))iss.push(`[kr] 미장 날짜 틀림(정답 ${MD(ses)}): ${h}`);
      if(!h.includes(MD(tg)))iss.push(`[kr] 반영될 코스피 날짜 틀림(정답 ${MD(tg)}): ${h}`);
      if(tg==k.day&&!h.includes('오늘'))iss.push(`[kr] 오늘 장인데 '오늘' 없음: ${h}`);
      if(tg!=k.day&&h.includes('오늘'))iss.push(`[kr] 오늘 장 아닌데 '오늘': ${h}`);
      if(tg==k.day&&k.m>=(KRSP[k.day]||[540,930])[1]&&!/반영 끝/.test(h))iss.push(`[kr] 오늘 장 끝났는데 반영완료 표시 없음: ${h}`)}}
   }
   // 개별 종목 화면 2개
   for(const [arg,nm] of [[{code:'005930',m:'KR'},'stock005930'],[{code:'NVDA',m:'US'},'stockNVDA']]){await pg.evaluate(a=>go('stock',a),arg);await pg.waitForTimeout(2500);
    const o=await pg.evaluate(()=>{const t=document.getElementById('view').innerText,o=[];for(const w of ['NaN','undefined','Infinity','[object']){const i=t.indexOf(w);if(i>=0)o.push(`글자오류 "${w}": …${t.slice(Math.max(0,i-30),i+15).replace(/\n/g,' ')}`)}if(/자료를 불러오지 못했습니다/.test(t))o.push('불러오기 실패');return o});o.forEach(x=>iss.push(`[${nm}] `+x))}
   // 뒤로가기
   await pg.goBack();await pg.waitForTimeout(1500);const vb=await pg.evaluate(()=>[VIEW,CURARG&&CURARG.code]);if(!(vb[0]=='stock'&&vb[1]=='005930'))iss.push('[nav] 뒤로가기 틀림: '+vb);
   await pg.goBack();await pg.waitForTimeout(1500);const vc=await pg.evaluate(()=>VIEW);if(vc!='score')iss.push('[nav] 두 번째 뒤로가기 틀림: '+vc);
  }catch(e){iss.push('감사 실행 오류: '+e.message.slice(0,150))}
  errs.forEach(e=>iss.push(e));await ctx.close();
  const ok=!iss.length;log.push({round:i+1,time:tag,ok,iss:[...new Set(iss)]});console.log(`${i+1}회 ${tag} ${ok?'통과':'실패 '+[...new Set(iss)].length+'건'}`);
  if(!ok){[...new Set(iss)].slice(0,15).forEach(x=>console.log('   - '+x));fails++}}
 let nx=START-1;const W=+process.env.W||6;await Promise.all(Array.from({length:W},async()=>{while(nx<N){const i=nx++;await one(i)}}));log.sort((x,y)=>x.round-y.round);

 fs.writeFileSync('last_run.json',JSON.stringify(log,null,1));await br.close();srv.close();process.exit(fails?1:0)})();
