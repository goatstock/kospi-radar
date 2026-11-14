const C="goat-v20261114w14-d20261113";
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["./","index.html","manifest.json","icon-192.png","icon-512.png","logo.png"])));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
/* 화면(UI)은 오프라인 대체 허용. 시세·분석 자료(data/)는 네트워크 실패 시 저장본을 주되 'X-From-Cache' 표시를 붙이고,
   장중 실시간 자료(data/live/)와 다른 서버(중계)는 저장본으로 대체하지 않음 — 2026-11-13 감사 GS-009 */
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);
 if(u.origin!==location.origin||/\/(api|rt)\//.test(u.pathname))return;
 const live=/\/data\/live\//.test(u.pathname),data=/\/data\//.test(u.pathname);
 e.respondWith(fetch(e.request).then(r=>{if(!live&&r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{})}return r}).catch(async()=>{
  if(live)return new Response("{}",{status:503,headers:{"content-type":"application/json"}});
  const hit=await caches.match(e.request);if(!hit)return Response.error();
  if(!data)return hit;const h=new Headers(hit.headers);h.set("X-From-Cache","1");return new Response(await hit.blob(),{status:200,headers:h})}))});
