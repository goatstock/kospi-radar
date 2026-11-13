const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8773);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t,{pct=1.2,sc=null,hash='',tour=false}={}){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));${tour?'':"localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'));"}`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(sc&&u.includes('/data/selfcheck.json'))return ro.fulfill({contentType:'application/json',body:JSON.stringify(sc)});
   if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[70000,pct,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:U.pathname=='/news'?{t:'10:00',at:t,n:3,items:[{src:'CNBC',title:'Nvidia rallies',ko:'엔비디아 급등',link:'https://e.com/1',ts:t},{src:'CNBC',title:'Fed holds rates',ko:'연준 금리 동결',link:'https://e.com/2',ts:t},{src:'WSJ',title:'Oil jumps',ko:'유가 급등',link:'https://e.com/3',ts:t}]}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8773/kospi-radar/'+hash);await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);const P=[pg];pg.on('dialog',d=>d.accept());
 // 51
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2500);
 const st=await pg.evaluate(()=>{const f=CUR.flows;const calc=k=>{let n=0,s=0;for(let i=f.length-1;i>=0;i--){const v=f[i][k];if(!v)break;const g=v>0?1:-1;if(!s)s=g;if(g!=s)break;n++}return[s,n]};return{f:calc(1),i:calc(2),t:(document.querySelector('.card .snote')||{}).innerText||''}});
 const expF=st.f[1]>=2?`외국인 ${st.f[1]}일 연속 순${st.f[0]>0?'매수':'매도'}`:'외국인 ';ok('제51회 외국인 연속 일수 맞음',st.t.includes(expF),st.t+' / '+JSON.stringify(st.f));
 // 52 clues: craft a stock with known facts via route
 const d0=JSON.parse(fs.readFileSync(ROOT+'/data/KR/005930.json','utf8'));const b=d0.bars;const L=b.at(-1).slice();const P0=b.at(-2);const av=b.slice(-21,-1).map(x=>x[5]).reduce((a,c)=>a+c,0)/20;
 L[1]=P0[4]*1.03;L[5]=av*3;L[2]=Math.max(...b.slice(-250).map(x=>x[2]))+1;const d1={...d0,bars:[...b.slice(0,-1),L]};
 await pg.route('**/data/KR/005930.json',ro=>ro.fulfill({contentType:'application/json',body:JSON.stringify(d1)}));await pg.evaluate(()=>{delete CACHE['data/KR/005930.json'];go('stock',{code:'005930',m:'KR'})});await pg.waitForTimeout(2500);
 const cl=await pg.evaluate(()=>[...document.querySelectorAll('.snote')].map(e=>e.innerText).find(t=>t.includes('움직임 단서'))||'');
 ok('제52회 움직임 단서: 거래량 3.0배·시초 +3.0%·1년 최고가',cl.includes('20일 평균의 3.0배')&&cl.includes('+3.0%에서 출발')&&cl.includes('1년 최고가 경신')&&cl.includes('단정하지 않습니다'),cl);
 await pg.unroute('**/data/KR/005930.json');
 // 56 same grade
 await pg.evaluate(()=>{delete CACHE['data/KR/005930.json'];go('stock',{code:'005930',m:'KR'})});await pg.waitForTimeout(3000);const sg=await pg.evaluate(async()=>{const ix=await J('data/KR/index.json');const me=ix.rows.find(r=>r[0]=='005930');const t=[...document.querySelectorAll('.card h3')].find(h=>h.innerText.includes('등급의 다른 종목'));if(!t)return{none:true,g:me[3]};const codes=[...t.parentElement.querySelectorAll('.row')].map(e=>e.getAttribute('onclick').match(/code:'([^']+)'/)[1]);const M=new Map(ix.rows.map(r=>[r[0],r]));return{g:me[3],ok:codes.length>0&&codes.every(c=>M.get(c)[3]==me[3]&&c!='005930'),n:codes.length}});
 ok('제56회 같은 등급 종목(자기 자신 제외)',sg.ok,JSON.stringify(sg));
 // 57 preview
 await pg.fill('#pq','10');await pg.waitForTimeout(200);const pv=await pg.evaluate(()=>{const px=CUR.signal.close??CUR.bars.at(-1)[4];return{t:document.getElementById('pprev').innerText,px}});
 ok('제57회 예상 비용 미리보기',pv.t.includes(Math.round(pv.px*10).toLocaleString('en-US'))&&pv.t.includes('수수료'),pv.t);
 // 54 watch strip
 await pg.evaluate(()=>{LS.s('goat_watch',[{m:'KR',c:'005930',n:'삼성전자'},{m:'US',c:'NVDA',n:'엔비디아'}]);go('kr')});await pg.waitForTimeout(3500);const ws=await pg.evaluate(()=>(document.querySelector('.wstrip')||{}).innerText||'');ok('제54회 국내 첫 화면 관심종목 띠',ws.includes('삼성전자')&&ws.includes('NVDA')&&ws.includes('관심 관리'),ws);
 const p2=await page(T);P.push(p2);await p2.waitForTimeout(1500);ok('제54회 관심종목 없으면 띠 없음',await p2.evaluate(()=>!document.querySelector('.wstrip')&&!document.getElementById('wstrip')));
 // 55 recent search
 await pg.evaluate(()=>go('find'));await pg.waitForTimeout(1500);await pg.fill('#q','하이닉스');await pg.waitForTimeout(300);await pg.click('#sr .row');await pg.waitForTimeout(1500);await pg.evaluate(()=>go('find'));await pg.waitForTimeout(1500);
 const qc=await pg.evaluate(()=>(document.querySelector('.qch')||{}).innerText||'');ok('제55회 최근 검색어 저장·표시',qc.includes('하이닉스'),qc);await pg.click('.qch button:first-child');await pg.waitForTimeout(300);ok('제55회 누르면 다시 검색',(await pg.innerText('#sr')).includes('SK하이닉스'));
 // 58 sell all (market open, mock price 70000)
 await pg.evaluate(()=>{const P=pLoad('KR');P.pos={'005930':{n:10,avg:60000,name:'삼성전자'},'000660':{n:2,avg:100000,name:'SK하이닉스'}};P.cash=1000000;pSave(P,'KR')});await pg.evaluate(()=>pSellAll('KR'));await pg.waitForTimeout(2000);
 const sa=await pg.evaluate(()=>{const P=pLoad('KR');return{n:Object.keys(P.pos).length,cash:P.cash,log:P.log.slice(0,2).map(x=>x.side)}});const expCash=1000000+70000*12-Math.round(70000*10*0.00015)-Math.round(70000*10*0.002)-Math.round(70000*2*0.00015)-Math.round(70000*2*0.002);
 ok('제58회 전량 정리: 보유 0·현금 계산 맞음',sa.n==0&&Math.abs(sa.cash-expCash)<=2&&sa.log.every(x=>x=='매도'),JSON.stringify(sa)+' exp '+expCash);
 const p3=await page(Date.parse('2026-11-14T12:00:00+09:00'));P.push(p3);p3.on('dialog',d=>d.accept());await p3.evaluate(()=>{const P=pLoad('KR');P.pos={'005930':{n:5,avg:60000,name:'삼성전자'}};pSave(P,'KR')});await p3.evaluate(()=>pSellAll('KR'));await p3.waitForTimeout(800);
 ok('제58회 장 닫힘이면 전량 매도 예약',await p3.evaluate(()=>{const P=pLoad('KR');return P.pend.length==1&&P.pend[0].side==-1&&P.pend[0].n==5&&Object.keys(P.pos).length==1}));
 // 59 buzz (vibrate called)
 await pg.evaluate(()=>{window.__vib=0;navigator.vibrate=()=>{window.__vib++;return true};LS.s('goat_alert',{'KR:005930':{m:'KR',c:'005930',n:'삼성전자',up:1}})});await pg.evaluate(()=>alertTick());await pg.waitForTimeout(600);ok('제59회 알림 때 진동',await pg.evaluate(()=>window.__vib==1));
 // 53 ledger note
 const RL=JSON.parse(fs.readFileSync(ROOT+'/data/KR/radar.json','utf8'));const nt=await pg.evaluate(L=>ledgerNote(L),RL);
 const c=RL.curve;let exp='';if(c.length>=10&&RL.b0){const a=c.at(-1),b2=c[Math.max(0,c.length-21)];exp=((a.eq/b2.eq-1)*100).toFixed(2)}ok('제53회 원장 vs 지수 최근 20일',c.length<10?nt=='':nt.includes(exp),`curve ${c.length} → ${nt.slice(0,120)}`);
 const syn={b0:100,bname:'코스피',seed:1e7,curve:Array.from({length:25},(_,i)=>({d:'d'+i,eq:1e7*(1-i*0.002),bench:100*(1+i*0.002)}))};const sn=await pg.evaluate(L=>ledgerNote(L),syn);const er=((syn.curve[24].eq/syn.curve[4].eq-1)*100).toFixed(2),ek=((syn.curve[24].bench/syn.curve[4].bench-1)*100).toFixed(2);
 ok('제53회 합성 25일: 원장 '+er+'% vs 지수 +'+ek+'% → 경고',sn.includes(er+'%')&&sn.includes('+'+ek+'%')&&sn.includes('⚠'),sn.slice(0,160));
 // 60 vs S&P (mock /uh deterministic in page(): returns c:[] → card removed). use route
 await pg.route('**/uh',ro=>ro.fulfill({contentType:'application/json',body:JSON.stringify({t:'x',c:Array.from({length:30},(_,i)=>6000*(1+i*0.001))})}));await pg.evaluate(()=>go('stock',{code:'NVDA',m:'US'}));await pg.waitForTimeout(2500);
 const vs=await pg.evaluate(()=>{const b=CUR.bars;const s=(b.at(-1)[4]/b.at(-21)[4]-1)*100;const H=Array.from({length:30},(_,i)=>6000*(1+i*0.001));const k=(H.at(-1)/H.at(-21)-1)*100;return{t:(document.getElementById('vsix')||{}).innerText||'',df:(s-k).toFixed(1)}});
 ok('제60회 S&P500 대비 20일 성과',vs.t.includes(vs.df.replace('-','')+'%p'),JSON.stringify(vs));
 for(const p of P)ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
