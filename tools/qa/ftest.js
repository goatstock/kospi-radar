// 제1~10회 기능 시험
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||require('path').resolve(__dirname,'../..');
const srv=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p.replace('/kospi-radar',''));fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html; charset=utf-8'});s.end(b)})}).listen(8767);
const R=[];const ok=(n,c,msg)=>{R.push([n,!!c,msg||''])};
(async()=>{const br=await chromium.launch();
 async function page(t,price=70000){const ctx=await br.newContext({serviceWorkers:'block',viewport:{width:430,height:900}});
  await ctx.addInitScript(`localStorage.setItem('gs_trial_start',String(${t-36e5}));localStorage.setItem('goat_tour','1');localStorage.setItem('goat_seen_v',JSON.stringify('2026.11.13 · 개선 100회'))`);
  await ctx.route('**/*',ro=>{const u=ro.request().url();if(u.includes('workers.dev')){const U=new URL(u);const cs=(U.searchParams.get('c')||U.searchParams.get('s')||'').split(',').filter(Boolean);
    const body=U.pathname=='/q'||U.pathname=='/uq'?{t:'10:00:00',p:Object.fromEntries(cs.map(c=>[c,[price,1.2,Math.floor(t/1e3)]]))}:U.pathname=='/i'?{t:'10:00:00',i:{KOSPI:[2600,0.1,'OPEN'],KOSDAQ:[800,0.1,'OPEN']}}:{t:'10:00:00',p:{},c:[],fx:{},items:[]};
    return ro.fulfill({contentType:'application/json',body:JSON.stringify(body)})}if(u.startsWith('http://localhost'))return ro.continue();return ro.abort()});
  const pg=await ctx.newPage();await pg.clock.setFixedTime(new Date(t));const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.errs=errs;pg.ctx=ctx;return pg}
 const T=Date.parse('2026-11-13T10:00:00+09:00');let pg=await page(T);
 await pg.goto('http://localhost:8767/kospi-radar/');await pg.waitForTimeout(2000);
 // 1 관심종목
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2000);
 ok('제1회 관심종목 버튼 표시',await pg.$('#wbtn'));await pg.click('#wbtn');await pg.waitForTimeout(300);
 ok('제1회 ★ 저장',await pg.evaluate(()=>wHas('KR','005930')&&document.getElementById('wbtn').textContent=='★'));
 await pg.click('#wbtn');ok('제1회 ★ 해제',await pg.evaluate(()=>!wHas('KR','005930')));await pg.click('#wbtn');
 // 2 최근 본 종목 + 검색 첫화면
 await pg.evaluate(()=>go('stock',{code:'000660',m:'KR'}));await pg.waitForTimeout(1500);
 await pg.evaluate(()=>go('find'));await pg.waitForTimeout(1500);const fh=await pg.innerText('#sr');
 ok('제2회 최근 본 종목 표시',fh.includes('최근 본 종목')&&fh.includes('SK하이닉스')&&fh.indexOf('SK하이닉스')<fh.lastIndexOf('삼성전자'),fh.slice(0,120));
 ok('제1회 검색 첫화면 관심종목',fh.includes('관심종목')&&fh.includes('삼성전자'));
 // 3 초성
 await pg.fill('#q','ㅅㅅㅈㅈ');await pg.waitForTimeout(400);let sr=await pg.innerText('#sr');ok('제3회 초성 ㅅㅅㅈㅈ→삼성전자 1순위',sr.split('\n')[0].startsWith('삼성전자'),sr.slice(0,60));
 await pg.fill('#q','ㅎㄷㅊ');await pg.waitForTimeout(300);sr=await pg.innerText('#sr');ok('제3회 초성 ㅎㄷㅊ→현대차',sr.includes('현대차'),sr.slice(0,60));
 await pg.fill('#q','AAPL');await pg.waitForTimeout(300);sr=await pg.innerText('#sr');ok('제3회 영문 검색 유지',sr.split('\n')[0].includes('애플')&&sr.includes('AAPL'),sr.slice(0,40));
 // 5·7 가격 위치
 await pg.evaluate(()=>go('stock',{code:'005930',m:'KR'}));await pg.waitForTimeout(2000);
 const rg=await pg.evaluate(()=>{const c=document.querySelector('.rngc');if(!c)return null;const d=CUR.bars.slice(-250),hi=Math.max(...d.map(b=>b[2])),lo=Math.min(...d.map(b=>b[3])),cl=d[d.length-1][4];return{t:c.innerText,pos:Math.round((cl-lo)/(hi-lo)*100),hi,lo}});
 ok('제5회 52주 위치 계산 맞음',rg&&rg.t.includes(rg.pos+'% 위치'),rg&&rg.t.slice(0,200));
 ok('제7회 거래량 배수 표시',rg&&/20일 평균의 [\d.]+배/.test(rg.t));
 // 8 가격 알림 저장 → 도달 시 울림
 await pg.fill('#alUp','69000');await pg.click('.alertc .pill');await pg.waitForTimeout(300);
 ok('제8회 알림 저장',await pg.evaluate(()=>LS.g('goat_alert',{})['KR:005930'].up==69000));
 await pg.evaluate(()=>alertTick());await pg.waitForTimeout(800);const tt=await pg.evaluate(()=>(document.getElementById('toast')||{}).textContent||'');
 ok('제8회 도달 시 알림 + 1회 후 꺼짐',tt.includes('이상 도달')&&await pg.evaluate(()=>!LS.g('goat_alert',{})['KR:005930']),tt);
 // 4 공유 링크 / 딥링크
 const p2=await page(T);await p2.goto('http://localhost:8767/kospi-radar/#s=KR:000660');await p2.waitForTimeout(2500);
 ok('제4회 딥링크로 종목 바로 열기',await p2.evaluate(()=>VIEW=='stock'&&CURARG&&CURARG.code=='000660'));
 const p3=await page(T);await p3.goto('http://localhost:8767/kospi-radar/#s=US:NVDA');await p3.waitForTimeout(2500);ok('제4회 미국 종목 딥링크',await p3.evaluate(()=>VIEW=='stock'&&CURARG.code=='NVDA'));
 const p4=await page(T);await p4.goto('http://localhost:8767/kospi-radar/#s=KR:<script>');await p4.waitForTimeout(2000);ok('제4회 이상한 링크는 무시',await p4.evaluate(()=>VIEW=='kr'));
 // 6 상승률/하락률
 await pg.evaluate(()=>{go('kr')});await pg.waitForTimeout(3000);await pg.evaluate(()=>{SEG='상승률';krList()});await pg.waitForTimeout(1500);
 const mv=await pg.evaluate(()=>{const ps=[...document.querySelectorAll('#klist .row .px')].map(e=>parseFloat(e.innerText.split('\n').pop().replace('%','')));return ps});
 ok('제6회 상승률 내림차순',mv.length>5&&mv.every((x,i)=>i==0||mv[i-1]>=x),mv.slice(0,5).join(','));
 await pg.evaluate(()=>{SEG='하락률';krList()});await pg.waitForTimeout(1500);
 const mv2=await pg.evaluate(()=>[...document.querySelectorAll('#klist .row .px')].map(e=>parseFloat(e.innerText.split('\n').pop().replace('%',''))));
 ok('제6회 하락률 오름차순',mv2.length>5&&mv2.every((x,i)=>i==0||mv2[i-1]<=x)&&mv2[0]<0,mv2.slice(0,5).join(','));
 // 10 지도
 const hm=await pg.evaluate(()=>{const t=[...document.querySelectorAll('.hmt')];return{n:t.length,first:t[0]&&t[0].innerText}});ok('제10회 시장 지도 40칸',hm.n==40,JSON.stringify(hm));
 await pg.evaluate(()=>{document.querySelector('.hm').open=true;document.querySelector('.hmt').click()});await pg.waitForTimeout(1500);ok('제10회 지도 칸 누르면 종목',await pg.evaluate(()=>VIEW=='stock'));
 // 9 자료 지연 경고: 11-14 09:00 (기대 11-13) vs 11-13 10:00 (기대 11-12)
 const p5=await page(Date.parse('2026-11-17T09:00:00+09:00'));await p5.goto('http://localhost:8767/kospi-radar/');await p5.waitForTimeout(2500);
 const sb=await p5.evaluate(()=>(document.getElementById('staleb')||{}).innerText||'');ok('제9회 자료 밀리면 경고(11-17 09시, 기대 11-16)',sb.includes('2026-11-16'),sb.slice(0,80));
 ok('제9회 정상이면 경고 없음(11-13 10시)',await pg.evaluate(()=>!document.getElementById('staleb')));
 ok('제9회 기대일 계산: 11-13 07:59→11-11',await pg.evaluate(()=>expectAsof(new Date('2026-11-13T07:59:00+09:00'))=='2026-11-11'));
 ok('제9회 기대일 계산: 11-16(월) 09:00→11-13(금)',await pg.evaluate(()=>expectAsof(new Date('2026-11-16T09:00:00+09:00'))=='2026-11-13'));
 ok('제9회 기대일 계산: 12-26 09:00→12-24(성탄 휴장)',await pg.evaluate(()=>expectAsof(new Date('2026-12-26T09:00:00+09:00'))=='2026-12-24'));
 for(const p of [pg,p2,p3,p4,p5])ok('JS오류 없음',!p.errs.length,p.errs.join('|'));
 R.forEach(([n,c,m])=>console.log((c?'합격 ':'실패 ')+n+(c?'':'  ← '+m)));console.log(`합계 ${R.filter(x=>x[1]).length}/${R.length}`);await br.close();srv.close()})();
