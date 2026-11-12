// GOAT STOCK 실시간 시세 중계 (Cloudflare Worker, 무료 요금제). 시세 조회 전용 — 주문·계좌 없음.
// 휴대폰 앱 → 이 Worker → 네이버 시세 → 5초 캐시 → 앱. 브라우저는 네이버를 직접 못 부르므로(CORS) 중계가 필요.
// 쓰는 법: GET /q?c=005930,000660  → {"t":"11:58:03","p":{"005930":[212250,3.03,"OPEN"],...}}
//          GET /i                  → 코스피·코스닥 지수
//          GET /m?c=000660         → 오늘 1분봉
const ORIGIN = "https://goatstock.github.io";
const H = { "User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/" };
const num = v => { const n = parseFloat(String(v ?? "").replace(/[,+%]/g, "")); return isNaN(n) ? null : n; };
const cors = b => new Response(JSON.stringify(b), { headers: { "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": ORIGIN, "cache-control": "public, max-age=5" } });
async function cached(req, ctx, fn) {
  const c = caches.default, k = new Request(req.url), hit = await c.match(k);
  if (hit) return hit;
  const res = cors(await fn()); ctx.waitUntil(c.put(k, res.clone())); return res;
}
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 19);
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const codes = (u.searchParams.get("c") || "").split(",").filter(x => /^[0-9A-Z]{6}$/.test(x)).slice(0, 60);
    if (u.pathname === "/q") return cached(req, ctx, async () => {
      const p = {};
      await Promise.all(codes.map(async c => {
        try { const j = await (await fetch(`https://m.stock.naver.com/api/stock/${c}/basic`, { headers: H })).json();
          p[c] = [num(j.closePrice), num(j.fluctuationsRatio), j.marketStatus]; } catch (e) {}
      }));
      return { t: kst(), p };
    });
    if (u.pathname === "/i") return cached(req, ctx, async () => {
      const out = {};
      for (const c of ["KOSPI", "KOSDAQ"]) {
        try { const j = await (await fetch(`https://m.stock.naver.com/api/index/${c}/basic`, { headers: H })).json();
          out[c] = [num(j.closePrice), num(j.fluctuationsRatio), j.marketStatus]; } catch (e) {}
      }
      return { t: kst(), i: out };
    });
    if (u.pathname === "/m" && codes[0]) return cached(req, ctx, async () => {
      const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
      const j = await (await fetch(`https://api.stock.naver.com/chart/domestic/item/${codes[0]}/minute?startDateTime=${d}0900&endDateTime=${d}1530`, { headers: H })).json();
      return { t: kst(), b: (j || []).map(x => [x.localDateTime.slice(8, 12), x.openPrice, x.highPrice, x.lowPrice, x.currentPrice, x.accumulatedTradingVolume]) };
    });
    return cors({ ok: true, use: "/q?c=005930  /i  /m?c=000660" });
  }
};
