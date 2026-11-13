const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8778);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t,{pct=1.2,sc=null,hash='',tour=false,seen=true}={}){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));${tour?'':"localStorage.setItem('goat_tour','1');"}${seen?"localStorage.setItem('goat_seen_v','\"2026.11.13 · 개선 100회\"');":''}`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(sc&&u.includes('/data/selfcheck.json'))return ro.fulfill({contentType:'application/json',body:JSON.stringify(sc)});
   if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[70000,pct,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:U.pathname=='/news'?{t:'10:00',at:t,n:3,items:[{src:'CNBC',title:'Nvidia rallies',ko:'엔비디아 급등',link:'https://e.com/1',ts:t},{src:'CNBC',title:'Fed holds rates',ko:'연준 금리 동결',link:'https://e.com/2',ts:t},{src:'WSJ',title:'Oil jumps',ko:'유가 급등',link:'https://e.com/3',ts:t}]}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8778/kospi-radar/'+hash);await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);const P=[pg];pg.on('dialog',d=>d.accept());
 // 91 glossary link in reasons
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2500);const gl=await pg.evaluate(()=>[...document.querySelectorAll('.reasons .glink')].map(b=>b.textContent));
 if(gl.length){await pg.click('.reasons .glink');await pg.waitForTimeout(200)}const gt=await pg.evaluate(()=>(document.getElementById('toast')||{}).textContent||'');
 const any=await pg.evaluate(()=>{const t=document.querySelector('.reasons')?document.querySelector('.reasons').textContent:'';return GLOS.some(([k])=>t.includes(k.split('(')[0]))});
 ok('제91회 점수 근거 속 용어 → 설명',any?(gl.length>0&&gt.includes(' — ')):true,JSON.stringify(gl)+' '+gt.slice(0,60));
 const h91=await pg.evaluate(()=>glossLink('-2 이평 정배열 아님 · 골든크로스 뒤 3일'));ok('제91회 용어 연결 함수(이평/골든크로스 중 첫 용어만, 글자 보존)',h91.includes('<button class="glink"')&&h91.replace(/<[^>]+>/g,'')=='-2 이평 정배열 아님 · 골든크로스 뒤 3일',h91);
 // 92 whats new
 const p2=await page(T,{seen:false});P.push(p2);await p2.waitForTimeout(2000);const wn=await p2.evaluate(()=>(document.getElementById('tour')||{}).innerText||'');ok('제92회 새 기능 안내(한 번)',wn.includes('새로 생긴 기능')&&wn.includes('수익을 보장하지 않습니다'),wn.slice(0,60));
 await p2.click('#tour .pill');await p2.reload();await p2.waitForTimeout(2500);ok('제92회 다시 열면 안 뜸',await p2.evaluate(()=>!document.getElementById('tour')));
 const p3=await page(T,{seen:false,tour:true});P.push(p3);await p3.waitForTimeout(2000);ok('제92회 처음 쓰는 분에게는 안내(제46회)를 먼저, 새 기능 창은 겹치지 않음',(await p3.innerText('#tour')).includes('1 / 4')&&await p3.evaluate(()=>document.querySelectorAll('#tour').length==1));
 // 93 cost
 await pg.evaluate(()=>{const P=pLoad('KR');P.pos={};P.log=[{t:1,code:'a',name:'a',side:'매수',n:1,px:1,fee:105,tax:0},{t:2,code:'a',name:'a',side:'매도',n:1,px:1,fee:110,tax:1400,pnl:5}];pSave(P,'KR');go('paper')});await pg.waitForTimeout(2500);ok('제93회 낸 수수료·세금 합계',(await pg.innerText('#view')).includes('수수료 215원 · 세금 1,400원 · 합계 1,615원'));
 // 95 cancel pending
 const ps=await page(Date.parse('2026-11-14T12:00:00+09:00'));P.push(ps);await ps.evaluate(()=>{const P=pLoad('KR');P.pend=[{t:1,code:'005930',name:'삼성전자',side:1,n:3},{t:2,code:'000660',name:'SK하이닉스',side:-1,n:1}];pSave(P,'KR');go('paper')});await ps.waitForTimeout(2500);
 await ps.evaluate(()=>[...document.querySelectorAll('.glink')].find(b=>b.textContent=='취소').click());await ps.waitForTimeout(1500);const pd=await ps.evaluate(()=>{const P=pLoad('KR');return{n:P.pend.length,left:P.pend[0]&&P.pend[0].code,log:P.log[0].side}});ok('제95회 예약 주문 1건 취소',pd.n==1&&pd.left=='000660'&&pd.log=='취소',JSON.stringify(pd));
 // 94 watch tabs
 await pg.evaluate(()=>{LS.s('goat_watch',[{m:'KR',c:'005930',n:'삼성전자'},{m:'US',c:'NVDA',n:'엔비디아'}]);go('find')});await pg.waitForTimeout(1500);await pg.click('#sr .mkf button:has-text("미국")');await pg.waitForTimeout(300);
 const wt=await pg.evaluate(()=>[...[...document.querySelectorAll('#sr .list')][0].querySelectorAll('.row .nm b')].map(b=>b.textContent));ok('제94회 관심종목 미국만',wt.length==1&&wt[0].includes('엔비디아'),wt.join('|'));
 // 100 quick star in search
 await pg.fill('#q','하이닉스');await pg.waitForTimeout(300);await pg.click('#sr .srow .wq');await pg.waitForTimeout(200);ok('제100회 검색 결과 ☆ 눌러 바로 담기',await pg.evaluate(()=>wHas('KR','000660')&&document.querySelector('#sr .srow .wq').textContent=='★'));
 await pg.click('#sr .srow .wq');ok('제100회 다시 누르면 빼기',await pg.evaluate(()=>!wHas('KR','000660')));
 // 96 fx alert
 await pg.route('**/fx',ro=>ro.fulfill({contentType:'application/json',body:JSON.stringify({t:'10:00',fx:{'USDKRW=X':[1462.5,0.1,[1450,1462.5],1500,1300]}})}));await pg.evaluate(()=>go('macro'));await pg.waitForTimeout(3000);
 await pg.fill('#fxaUp','1460');await pg.click('.fxcalc .pill:has-text("저장")');const fh=await pg.evaluate(()=>fxAlertTick());ok('제96회 원/달러 1,460 이상 → 1,462.5에서 알림·한 번 뒤 꺼짐',fh&&fh.includes('1,462.5원')&&await pg.evaluate(()=>LS.g('goat_fxalert',null)===null),fh);
 // 97 range buttons
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2500);await pg.click('.indt button:has-text("1년")');await pg.waitForTimeout(300);const n1=await pg.evaluate(()=>({n:Number(document.querySelector('#chart svg').dataset.n),tot:CUR.bars.length}));ok('제97회 1년 버튼 → 봉 250개(자료가 적으면 전부)',n1.n==Math.min(250,n1.tot),JSON.stringify(n1));
 // 98 flash
 const fl=await pg.evaluate(()=>{const e=document.createElement('span');document.body.appendChild(e);flash(e,'T',100);const a=e.className;flash(e,'T',101);const b=e.className;flash(e,'T',99);return [a,b,e.className]});ok('제98회 가격 오르면 빨강·내리면 파랑 반짝(첫 값은 안 반짝)',fl[0]==''&&fl[1].includes('fu')&&fl[2].includes('fd')&&!fl[2].includes('fu'),JSON.stringify(fl));
 // 99 maskable
 const man=JSON.parse(fs.readFileSync(ROOT+'/manifest.json','utf8'));const mk=man.icons.find(i=>i.purpose=='maskable');ok('제99회 둥근 아이콘용 별도 아이콘(안전 영역 안)',mk&&mk.src=='icon-maskable-512.png'&&fs.existsSync(ROOT+'/icon-maskable-512.png'),JSON.stringify(mk));
 for(const p of P)ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
