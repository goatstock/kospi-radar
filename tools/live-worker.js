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

// 해외 속보: 여러 RSS 제목을 모아 Workers AI(m2m100)로 한국어 번역, 60초 캐시
const FEEDS = [
  ["CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"],
  ["CNBC 시장", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"],
  ["CNN", "http://rss.cnn.com/rss/money_latest.rss"],
  ["MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories"],
  ["Yahoo", "https://finance.yahoo.com/news/rssindex"],
  ["Investing", "https://www.investing.com/rss/news_25.rss"],
  ["Google 뉴스", "https://news.google.com/rss/search?q=stock+market+when:1h&hl=en-US&gl=US&ceid=US:en"]
];
const unesc = t => t.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]+>/g, "").trim();
async function feed(src, url) {
  try {
    const x = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cf: { cacheTtl: 60 } })).text();
    return [...x.matchAll(/<item[\s\S]*?<\/item>/g)].slice(0, 12).map(m => {
      const g = tag => { const r = m[0].match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">")); return r ? unesc(r[1]) : ""; };
      return { src, title: g("title"), link: g("link"), ts: Date.parse(g("pubDate")) || 0 };
    }).filter(a => a.title);
  } catch (e) { return []; }
}
async function news(env) {
  const all = (await Promise.all(FEEDS.map(([s, u]) => feed(s, u)))).flat();
  const seen = new Set(), out = [];
  for (const a of all.sort((a, b) => b.ts - a.ts)) {
    const k = a.title.toLowerCase().slice(0, 60); if (seen.has(k)) continue; seen.add(k); out.push(a); if (out.length >= 40) break;
  }
  if (env && env.AI) {
    await Promise.all(out.map(async a => {
      try { const r = await env.AI.run("@cf/meta/m2m100-1.2b", { text: a.title, source_lang: "english", target_lang: "korean" }); a.ko = r.translated_text; } catch (e) {}
    }));
  }
  return { t: kst(), n: out.length, items: out };
}

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
    if (u.pathname === "/news") {
      const c = caches.default, k = new Request("https://cache.local/news"), hit = await c.match(k);
      if (hit) return new Response(hit.body, { headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": ORIGIN } });
      const body = JSON.stringify(await news(env));
      ctx.waitUntil(c.put(k, new Response(body, { headers: { "cache-control": "public, max-age=60" } })));
      return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": ORIGIN } });
    }
    return cors({ ok: true, use: "/q?c=005930  /i  /m?c=000660  /news" });
  }
};
