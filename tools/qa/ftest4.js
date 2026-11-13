const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8770);
const R=[];const ok=(n,c,msg)=>R.push([n,!!c,msg||'']);
(async()=>{const br=await chromium.launch();
 async function page(t,{pct=1.2,sc=null,hash=''}={}){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'))`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(sc&&u.includes('/data/selfcheck.json'))return ro.fulfill({contentType:'application/json',body:JSON.stringify(sc)});
   if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[70000,pct,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:U.pathname=='/news'?{t:'10:00',at:t,n:3,items:[{src:'CNBC',title:'Nvidia rallies',ko:'엔비디아 급등',link:'https://e.com/1',ts:t},{src:'CNBC',title:'Fed holds rates',ko:'연준 금리 동결',link:'https://e.com/2',ts:t},{src:'WSJ',title:'Oil jumps',ko:'유가 급등',link:'https://e.com/3',ts:t}]}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.goto('http://localhost:8770/kospi-radar/'+hash);await pg.waitForTimeout(2500);return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');const pg=await page(T);const P=[pg];
 // 31 equity
 await pg.evaluate(()=>{LS.s('goat_eq_KR',{'2026-11-11':10050000,'2026-11-12':9980000})});await pg.evaluate(()=>go('paper'));await pg.waitForTimeout(2500);
 const eq=await pg.evaluate(()=>({h:LS.g('goat_eq_KR',{}),svg:!!document.querySelector('svg[aria-label="내 계좌 자산 추이"]'),t:document.getElementById('view').innerText}));
 ok('제31회 오늘 자산 자동 기록 + 3일 그래프',eq.h['2026-11-13']==10000000&&eq.svg&&eq.t.includes('3일'),JSON.stringify(eq.h));
 // 32 CSV
 await pg.evaluate(()=>{const P=pLoad('KR');P.log=[{t:Date.parse('2026-11-12T01:00:00Z'),code:'005930',name:'삼성,"전자"',side:'매수',n:10,px:70000,fee:105,tax:0}];pSave(P,'KR')});
 const csv=await pg.evaluate(()=>pCsv('KR'));ok('제32회 CSV: 머리줄·쉼표/따옴표 이스케이프·한글 BOM',csv.startsWith('﻿시각(KST)')&&csv.includes('"삼성,""전자"""')&&csv.includes('2026-11-12 10:00'),csv.slice(0,160));
 await pg.evaluate(()=>go('paper'));await pg.waitForTimeout(2000);const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:5000}).catch(()=>null),pg.click('text=엑셀(CSV) 저장')]);ok('제32회 버튼 누르면 파일 내려받기',dl&&/goatstock_paper_KR_2026-11-13\.csv/.test(dl.suggestedFilename()),dl&&dl.suggestedFilename());
 // 33/34 watch sort + summary
 await pg.evaluate(()=>{LS.s('goat_watch',[{m:'KR',c:'005930',n:'삼성전자'},{m:'KR',c:'000660',n:'SK하이닉스'},{m:'US',c:'NVDA',n:'엔비디아'}]);go('find')});await pg.waitForTimeout(2000);
 const ws=await pg.evaluate(async()=>{const k=await J('data/KR/index.json'),u=await J('data/US/index.json');const g=c=>[...k.rows,...u.rows].find(r=>r[0]==c)[5];const p=['005930','000660','NVDA'].map(g);return{sum:document.querySelector('.wsum').innerText,p}});
 const up=ws.p.filter(x=>x>0).length,dn=ws.p.filter(x=>x<0).length,av=ws.p.reduce((a,b)=>a+b,0)/3;
 ok('제34회 관심종목 오늘 요약 숫자',ws.sum.includes('3종목')&&ws.sum.includes('오름 '+up)&&ws.sum.includes('내림 '+dn)&&ws.sum.includes((av>0?'+':'')+av.toFixed(2)+'%'),ws.sum+' '+ws.p);
 await pg.click('#sr .mkf button:has-text("등락률")');await pg.waitForTimeout(300);
 const ord=await pg.evaluate(()=>[...document.querySelectorAll('#sr .list')][0].querySelectorAll('.row .nm b').length&&[...[...document.querySelectorAll('#sr .list')][0].querySelectorAll('.row .nm b')].map(b=>b.textContent.split(' (')[0]));
 const exp=[['삼성전자',ws.p[0]],['SK하이닉스',ws.p[1]],['엔비디아',ws.p[2]]].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);ok('제33회 관심종목 등락률 순 정렬',JSON.stringify(ord)==JSON.stringify(exp),JSON.stringify(ord)+' vs '+JSON.stringify(exp));
 // 35 dark auto
 const ctxD=await br.newContext({serviceWorkers:'block',colorScheme:'dark'});await ctxD.addInitScript(`localStorage.setItem('gs_trial_start',String(${T-36e5}));localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'))`);await ctxD.route('**/*',ro=>ro.request().url().startsWith('http://localhost')?ro.continue():ro.abort());
 const pd=await ctxD.newPage();pd.errs=[];pd.on('pageerror',e=>pd.errs.push(e.message));await pd.clock.setFixedTime(new Date(T));await pd.goto('http://localhost:8770/kospi-radar/');await pd.waitForTimeout(1500);ok('제35회 휴대폰이 어두운 화면이면 자동 다크',await pd.evaluate(()=>document.body.dataset.mt=='dark'));
 await pd.evaluate(()=>localStorage.setItem('m_theme','light'));await pd.reload();await pd.waitForTimeout(1500);ok('제35회 직접 고른 밝기는 유지',await pd.evaluate(()=>document.body.dataset.mt=='light'));
 // 36 fx calc (mock /fx)
 await pg.route('**/fx',ro=>ro.fulfill({contentType:'application/json',body:JSON.stringify({t:'10:00',fx:{'USDKRW=X':[1400,0.1,[1390,1400],1500,1300],'JPYKRW=X':[930,0.1,[920,930],1000,900]}})}));
 await pg.evaluate(()=>go('macro'));await pg.waitForTimeout(3000);
 const c1=await pg.evaluate(()=>{$('#fxa').value='250';return fxCalc()});ok('제36회 250달러 = 350,000원',c1=='250 USD = 350,000원',c1);
 const c2=await pg.evaluate(()=>{$('#fxs').value='JPYKRW=X';$('#fxa').value='10000';return fxCalc()});ok('제36회 10,000엔 = 93,000원(100엔 기준 환산)',c2=='10,000 JPY = 93,000원',c2);
 const c3=await pg.evaluate(()=>{FXREV=true;$('#fxs').value='USDKRW=X';$('#fxa').value='1400000';return fxCalc()});ok('제36회 거꾸로 1,400,000원 = 1,000달러',c3=='1,400,000원 = 1,000 USD',c3);
 await pg.evaluate(()=>fxCard());await pg.waitForTimeout(800);ok('제36회 1분 갱신에도 입력값 유지',await pg.evaluate(()=>$('#fxa').value=='1400000'));
 // 37 prev/next
 await pg.evaluate(()=>{FXREV=false;go('kr')});await pg.waitForTimeout(3000);const L=await pg.evaluate(()=>LASTLIST.slice(0,3));
 await pg.evaluate(c=>go('stock',{code:c,m:'KR'}),L[1][0]);await pg.waitForTimeout(2000);const nv=await pg.innerText('.pnav');ok('제37회 목록 2번째 종목: ‹ 1번째 · 2/N · 3번째 ›',nv.includes(L[0][2])&&nv.includes('2 /')&&nv.includes(L[2][2]),nv);
 await pg.evaluate(()=>document.activeElement.blur());await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(2000);ok('제37회 → 키로 다음 종목',await pg.evaluate(c=>CURARG.code==c,L[2][0]));
 // 38 breadth
 await pg.evaluate(()=>go('kr'));await pg.waitForTimeout(3000);const bd=await pg.evaluate(async()=>{const ix=await J('data/KR/index.json');const p=ix.rows.map(r=>r[5]).filter(x=>x!=null);return{u:p.filter(x=>x>0).length,d:p.filter(x=>x<0).length,t:[...document.querySelectorAll('.card h3')].find(h=>h.innerText.includes('오른 종목')).parentElement.innerText}});
 ok('제38회 국내 오른·내린 종목 수',bd.t.includes('오름 '+bd.u)&&bd.t.includes('내림 '+bd.d),bd.t.slice(0,120));
 // 39 search filter
 await pg.evaluate(()=>go('find'));await pg.waitForTimeout(1500);await pg.fill('#q','A');await pg.waitForTimeout(300);await pg.click('#fmk button:nth-child(3)');await pg.waitForTimeout(300);
 const f3=await pg.evaluate(()=>[...document.querySelectorAll('#sr .row .nm span')].map(e=>e.textContent));ok('제39회 검색 미국만',f3.length>0&&f3.every(t=>t.includes('미국')),f3.slice(0,3).join('|'));
 await pg.click('#fmk button:nth-child(2)');await pg.waitForTimeout(300);const f4=await pg.evaluate(()=>[...document.querySelectorAll('#sr .row .nm span')].map(e=>e.textContent));ok('제39회 검색 국내만',f4.length>0&&f4.every(t=>t.includes('국내')),f4.slice(0,3).join('|'));
 // 40 US news chips
 await pg.evaluate(()=>go('news'));await pg.waitForTimeout(2500);const ch=await pg.evaluate(()=>[...document.querySelectorAll('#nl .rel button')].map(b=>b.textContent));ok('제40회 엔비디아 속보 → 🇺🇸 엔비디아 + 국내 반도체 연결',ch.includes('🇺🇸 엔비디아')&&ch.includes('SK하이닉스'),ch.join('|'));
 await pg.evaluate(()=>[...document.querySelectorAll('#nl .rel button')].find(b=>b.textContent=='🇺🇸 엔비디아').click());await pg.waitForTimeout(2000);ok('제40회 누르면 미국 종목 화면',await pg.evaluate(()=>VIEW=='stock'&&CURARG.code=='NVDA'&&CURARG.m=='US'));
 P.push(pd);
 for(const p of P)ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
