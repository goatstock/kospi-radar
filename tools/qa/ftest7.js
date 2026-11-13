const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8774);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t,{pct=1.2,sc=null,hash='',tour=false}={}){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));${tour?'':"localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'));"}`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(sc&&u.includes('/data/selfcheck.json'))return ro.fulfill({contentType:'application/json',body:JSON.stringify(sc)});
   if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[70000,pct,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:U.pathname=='/news'?{t:'10:00',at:t,n:3,items:[{src:'CNBC',title:'Nvidia rallies',ko:'엔비디아 급등',link:'https://e.com/1',ts:t},{src:'CNBC',title:'Fed holds rates',ko:'연준 금리 동결',link:'https://e.com/2',ts:t},{src:'WSJ',title:'Oil jumps',ko:'유가 급등',link:'https://e.com/3',ts:t}]}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8774/kospi-radar/'+hash);await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);const P=[pg];pg.on('dialog',d=>d.accept());
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2500);
 // 61 BB: independent calc
 await pg.click('.indt button:has-text("볼린저밴드")');await pg.waitForTimeout(300);const bb=await pg.evaluate(()=>{const all=CUR.bars,n=20,i=all.length-1;const w=all.slice(i-19,i+1).map(b=>b[4]);const m=w.reduce((a,c)=>a+c,0)/20;const sd=Math.sqrt(w.reduce((a,c)=>a+(c-m)**2,0)/20);const B=bbands(all);return{pl:document.querySelectorAll('#chart polyline.bb').length,u:B.U[i],eu:m+2*sd,d:B.D[i],ed:m-2*sd,on:LS.g('goat_ind',{}).bb}});
 ok('제61회 볼린저밴드 선 2개·값 독립 계산과 일치·설정 기억',bb.pl==2&&Math.abs(bb.u-bb.eu)<1e-6&&Math.abs(bb.d-bb.ed)<1e-6&&bb.on==1,JSON.stringify(bb));
 // 62 RSI vs reference (cutler-free wilder) computed separately in node
 await pg.click('.indt button:has-text("RSI")');await pg.waitForTimeout(300);const rv=await pg.evaluate(()=>({app:rsi(CUR.bars).at(-1),closes:CUR.bars.map(b=>b[4]),lab:(document.querySelector('#chart svg[aria-label^="RSI"]')||{getAttribute:()=>''}).getAttribute('aria-label')}));
 const C=rv.closes;let g=0,l=0;for(let i=1;i<=14;i++){const d=C[i]-C[i-1];if(d>0)g+=d;else l-=d}g/=14;l/=14;for(let i=15;i<C.length;i++){const d=C[i]-C[i-1];g=(g*13+Math.max(d,0))/14;l=(l*13+Math.max(-d,0))/14}const ref=100-100/(1+g/l);
 ok('제62회 RSI(14) 별도 계산과 일치·그래프 표시',Math.abs(rv.app-ref)<1e-9&&rv.lab=='RSI '+ref.toFixed(0),`app ${rv.app} ref ${ref} ${rv.lab}`);
 // 63 perf
 const pf=await pg.evaluate(()=>{const b=CUR.bars,c=b.at(-1)[4];return{t:document.querySelector('.perf').innerText.replace(/\n/g,' '),w:((c/b.at(-6)[4]-1)*100).toFixed(1),m:((c/b.at(-22)[4]-1)*100).toFixed(1)}});ok('제63회 기간 수익률 1주·1달',pf.t.includes(pf.w+'%')&&pf.t.includes(pf.m+'%'),JSON.stringify(pf));
 // 68 png
 const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:8000}).catch(()=>null),pg.click('text=🖼 그림 저장')]);let png=null;if(dl){const pth=await dl.path();png=fs.readFileSync(pth)}
 ok('제68회 차트 PNG 저장(정상 PNG·가로 1080px)',png&&png.slice(1,4).toString()=='PNG'&&png.readUInt32BE(16)==1080,dl&&dl.suggestedFilename()+' '+(png&&png.length));
 // 66 breakeven
 await pg.evaluate(()=>{const P=pLoad('KR');P.pos={'005930':{n:10,avg:70000,name:'삼성전자'}};pSave(P,'KR');go('stock',{code:'005930',m:'KR'})});await pg.waitForTimeout(2500);
 const be=await pg.innerText('#pbox');const exB=Math.round(70000*(1+0.00015)/(1-0.00015-0.002)).toLocaleString('en-US');ok('제66회 본전 매도가(수수료·세금 포함)',be.includes(exB+'원'),be.slice(0,200)+' exp '+exB);
 // check breakeven: selling at be yields ~0 pnl via pFill
 const z=await pg.evaluate(()=>{const P={cash:0,pos:{'X':{n:100,avg:70000*(1+0.00015),name:'x'}},log:[]};const be=70000*(1+0.00015)/(1-0.00015-0.002);pFill(P,'KR',{code:'X',name:'x',side:-1,n:100},[be]);return P.log[0].pnl});ok('제66회 그 가격에 팔면 손익 0원(±반올림)',Math.abs(z)<=2,String(z));
 // 65 stats
 await pg.evaluate(()=>{const P=pLoad('KR');P.log=[{t:1,code:'a',name:'a',side:'매도',n:1,px:1,fee:0,tax:0,pnl:30000},{t:2,code:'b',name:'b',side:'매도',n:1,px:1,fee:0,tax:0,pnl:-10000},{t:3,code:'c',name:'c',side:'매도',n:1,px:1,fee:0,tax:0,pnl:10000},{t:4,code:'d',name:'d',side:'매수',n:1,px:1,fee:0,tax:0}];pSave(P,'KR');go('paper')});await pg.waitForTimeout(2500);
 const ps=await pg.innerText('#view');ok('제65회 승률 67%·이긴 평균 +20,000·진 평균 -10,000·손익비 2.00',ps.includes('매도 3번 승률')&&ps.includes('67%')&&ps.includes('+20,000원')&&ps.includes('-10,000원')&&ps.includes('손익비 2.00'),'');
 // 64 watch share & link
 await pg.evaluate(()=>{LS.s('goat_watch',[{m:'KR',c:'005930',n:'삼성전자'},{m:'US',c:'NVDA',n:'엔비디아'}])});await pg.evaluate(()=>{navigator.share=undefined});
 const ctx2=pg.context();await ctx2.grantPermissions(['clipboard-read','clipboard-write']);await pg.evaluate(()=>go('find'));await pg.waitForTimeout(1500);await pg.click('text=묶음 공유');await pg.waitForTimeout(400);const link=await pg.evaluate(()=>navigator.clipboard.readText());
 ok('제64회 묶음 공유 링크',link.endsWith('#w=KR:005930,US:NVDA'),link);
 const p2=await page(T,{hash:'#w=KR:005930,US:NVDA,KR:999999'});P.push(p2);await p2.waitForTimeout(2000);ok('제64회 링크로 열면 한 번에 담기(없는 종목 무시)',await p2.evaluate(()=>{const W=wList();return W.length==2&&VIEW=='find'}));
 // 67 US KRW toggle
 await pg.evaluate(()=>go('us'));await pg.waitForTimeout(3000);await pg.click('text=원화로도 보기');await pg.waitForTimeout(1200);const kr=await pg.evaluate(async()=>{const g=await J('data/KR/global.json');const fx=g.find(x=>x.symbol=='KRW=X').close;const r=document.querySelector('#ulist .row');const code=r.getAttribute('onclick').match(/code:'([^']+)'/)[1];const u=await J('data/US/index.json');const row=u.rows.find(x=>x[0]==code);const live=r.querySelector('.px b').textContent.replace(/[$,]/g,'');return{t:r.querySelector('.krw').textContent,exp:'≈'+Math.round(Number(live)*fx).toLocaleString('en-US')+'원',live}});
 ok('제67회 미국 목록 원화 병기',kr.t==kr.exp,JSON.stringify(kr));
 // 69 suggestions
 await pg.evaluate(()=>go('find'));await pg.waitForTimeout(1500);await pg.fill('#q','삼섬전자');await pg.waitForTimeout(400);const sg=await pg.innerText('#sr');ok('제69회 오타 "삼섬전자" → 삼성전자 제안',sg.includes('혹시 이 종목인가요')&&sg.includes('삼성전자'),sg.slice(0,100));
 await pg.fill('#q','엔비디아');await pg.waitForTimeout(300);await pg.press('#q','Enter');await pg.waitForTimeout(2000);ok('제70회 검색창 Enter → 첫 결과(엔비디아) 열기',await pg.evaluate(()=>VIEW=='stock'&&CURARG.code=='NVDA'));await pg.evaluate(()=>go('find'));await pg.waitForTimeout(1200);
 await pg.fill('#q','ㅋㅋㅋㅋㅋㅋㅋ');await pg.waitForTimeout(300);ok('제69회 엉뚱한 입력엔 제안 없음',!(await pg.innerText('#sr')).includes('혹시'));
 for(const p of P)ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
