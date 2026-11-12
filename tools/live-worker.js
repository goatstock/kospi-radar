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
// 번역: 한 번 번역한 제목은 하루 보관(재번역 없음). 새 제목만 Llama 3.1로 묶어서 번역, 실패하면 m2m100
const TRK = t => new Request("https://cache.local/tr2/" + encodeURIComponent(t.slice(0, 180)));
const MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast", "@cf/meta/llama-3.1-8b-instruct"];
async function llm(env, list) {
  const prompt = "Translate these English financial news headlines into natural Korean news headlines. Use Korean media spellings for names (Nvidia=엔비디아, Fed=연준, Jensen Huang=젠슨 황, Treasury=미 국채). Keep the numbering. Output only the numbered Korean lines.\n" + list.map((t, i) => (i + 1) + ". " + t).join("\n");
  let last = "";
  for (const m of MODELS) {
    try {
      const r = await env.AI.run(m, { messages: [{ role: "user", content: prompt }], max_tokens: 1800, temperature: 0.2 });
      const txt = typeof r === "string" ? r : (r.response ?? (r.result && r.result.response) ?? JSON.stringify(r));
      const out = {};
      String(txt).split("\n").forEach(l => { const mm = l.match(/^\s*\**\s*(\d+)[.)]\s*(.+)$/); if (mm) out[+mm[1] - 1] = mm[2].replace(/\*\*/g, "").trim(); });
      if (Object.keys(out).length) { out._m = m; return out; }
      last = m + ": " + String(txt).slice(0, 200);
    } catch (e) { last = m + ": " + e.message; }
  }
  return { _err: last };
}
async function translate(env, items) {
  const c = caches.default, need = [];
  await Promise.all(items.map(async a => { const h = await c.match(TRK(a.title)); if (h) a.ko = await h.text(); else need.push(a); }));
  if (!env || !env.AI || !need.length) return;
  for (let i = 0; i < need.length; i += 10) {
    const part = need.slice(i, i + 10);
    try { const o = await llm(env, part.map(a => a.title)); part.forEach((a, j) => { if (o[j] && /[가-힣]/.test(o[j])) { a.ko = o[j]; a.q = 1; } }); } catch (e) {}
  }
  await Promise.all(need.map(async a => {
    if (!a.ko) { try { const r = await env.AI.run("@cf/meta/m2m100-1.2b", { text: a.title, source_lang: "english", target_lang: "korean" }); a.ko = r.translated_text; } catch (e) {} }
    if (a.ko) await c.put(TRK(a.title), new Response(a.ko, { headers: { "cache-control": "public, max-age=" + (a.q ? 86400 : 1800) } }));
  }));
}
async function news(env) {
  const all = (await Promise.all(FEEDS.map(([s, u]) => feed(s, u)))).flat();
  const seen = new Set(), out = [];
  for (const a of all.sort((a, b) => b.ts - a.ts)) {
    const k = a.title.toLowerCase().slice(0, 60); if (seen.has(k)) continue; seen.add(k); out.push(a); if (out.length >= 40) break;
  }
  await translate(env, out);
  out.forEach(a => delete a.q);
  return { t: kst(), at: Date.now(), n: out.length, items: out };
}
// 환율: 야후 일봉 3개월 + 현재가. 원화 기준(엔·동은 100단위)과 달러 기준 주요 통화
const FX = [["USDKRW=X", 1], ["JPYKRW=X", 100], ["EURKRW=X", 1], ["CNYKRW=X", 1], ["GBPKRW=X", 1], ["HKDKRW=X", 1], ["TWDKRW=X", 1], ["AUDKRW=X", 1], ["CADKRW=X", 1], ["CHFKRW=X", 1], ["SGDKRW=X", 1], ["INRKRW=X", 1], ["VNDKRW=X", 100],
  ["DX-Y.NYB", 1], ["JPY=X", 1], ["EURUSD=X", 1], ["CNH=X", 1], ["TWD=X", 1], ["GBPUSD=X", 1]];
async function fxAll() {
  const out = {};
  await Promise.all(FX.map(async ([s, k]) => {
    try {
      const j = await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=3mo&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } })).json();
      const r = j.chart.result[0], m = r.meta, cl = (r.indicators.quote[0].close || []).filter(x => x != null).map(x => +(x * k).toFixed(4));
      const px = m.regularMarketPrice * k, prev = cl.length > 1 ? cl[cl.length - 2] : m.chartPreviousClose * k;
      out[s] = [+px.toFixed(4), m.regularMarketChangePercent ?? (prev ? (px / prev - 1) * 100 : null), cl, +(m.fiftyTwoWeekHigh * k).toFixed(4), +(m.fiftyTwoWeekLow * k).toFixed(4)];
    } catch (e) {}
  }));
  return { t: kst(), fx: out };
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
    if (u.pathname === "/fx") return cached(req, ctx, fxAll);
    if (u.pathname === "/night") return cached(req, ctx, async () => {
      const o = {};
      try { const j = await (await fetch("https://m.stock.naver.com/api/index/FUT/basic", { headers: H })).json(); o.fut = [num(j.closePrice), num(j.fluctuationsRatio), j.marketStatus, j.localTradedAt]; o.raw = JSON.stringify(j).slice(0, 700); } catch (e) { o.ferr = e.message; }
      try { const j = await (await fetch("https://polling.finance.naver.com/api/realtime/domestic/index/FUT", { headers: H })).json(); o.poll = JSON.stringify(j).slice(0, 700); } catch (e) { o.perr = e.message; }
      for (const s of ["NQ=F", "ES=F", "EWY"]) {
        try { const j = await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=1d&interval=5m`, { headers: { "User-Agent": "Mozilla/5.0" } })).json(); const m = j.chart.result[0].meta;
          o[s] = [m.regularMarketPrice, m.chartPreviousClose ? (m.regularMarketPrice / m.chartPreviousClose - 1) * 100 : null, m.regularMarketTime]; } catch (e) {}
      }
      return { t: kst(), ...o };
    });
    if (u.pathname === "/trtest") return cors(await llm(env, ["Nvidia slides as Fed holds rates", "Oil jumps on supply fears"]));
    if (u.pathname === "/news") {
      // 바로 응답: 보관본이 60초 넘었으면 보관본을 주고 뒤에서 새로 만듦
      const c = caches.default, k = new Request("https://cache.local/news3"), hit = await c.match(k);
      const H2 = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": ORIGIN };
      const make = async () => { const body = JSON.stringify(await news(env)); await c.put(k, new Response(body, { headers: { "cache-control": "public, max-age=86400" } })); return body; };
      if (hit) { const body = await hit.text(); let at = 0; try { at = JSON.parse(body).at || 0; } catch (e) {} if (Date.now() - at > 60000) ctx.waitUntil(make()); return new Response(body, { headers: H2 }); }
      return new Response(await make(), { headers: H2 });
    }
    return cors({ ok: true, use: "/q?c=005930  /i  /m?c=000660  /news  /fx  /night" });
  }
};
