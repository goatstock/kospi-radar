// GOAT STOCK 웹 서버 (Cloudflare Worker + D1) — 2026-11-13
// 목적: 앱 화면·자료를 로그인한 사람에게만 서버에서 내보낸다(공개 저장소에 자료 원본을 두지 않음).
// 바인딩: DB(D1 goatstock), LIVE(서비스: goatstock-live), OWNER_EMAIL(평문), PEPPER(비밀), REPO(평문, 예: goatstock/kospi-radar)
// 비밀값은 코드·저장소에 두지 않고 Cloudflare 환경변수로만 둔다.

const AI_BOTS = /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-Web|Claude-User|anthropic-ai|CCBot|Bytespider|PerplexityBot|Perplexity-User|Google-Extended|GoogleOther|Applebot-Extended|Amazonbot|meta-externalagent|meta-externalfetcher|FacebookBot|Diffbot|ImagesiftBot|cohere-ai|YouBot|Timpibot|omgili|DataForSeoBot|PetalBot|Scrapy|python-requests|python-urllib|curl\/|Wget|Go-http-client|HeadlessChrome|PhantomJS|node-fetch|undici|axios|httpx|aiohttp|libwww|okhttp|Java\/|Puppeteer|Playwright|Selenium/i;
const TEXT = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8", png: "image/png", webmanifest: "application/manifest+json" };
const APP_PUBLIC = new Set(["login.html", "terms.html", "manifest.json", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "logo.png", "logo-t.png", "wordmark.png"]);
const DAY = 86400000, TRIAL_MS = 3 * DAY, QUOTA = 4000;

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
function sec(h) {
  h.set("Content-Security-Policy", CSP);
  h.set("X-Frame-Options", "DENY");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  h.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  return h;
}
function J(o, st = 200, extra) { const h = sec(new Headers({ "content-type": TEXT.json, "cache-control": "no-store" })); if (extra) for (const [k, v] of Object.entries(extra)) h.append(k, v); return new Response(JSON.stringify(o), { status: st, headers: h }); }
const now = () => Date.now();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const rnd = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha(s) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
async function pwHash(pw, salt, pepper) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw + "\u0000" + pepper), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 10000 }, k, 256));
}
function ip(req) { return req.headers.get("cf-connecting-ip") || "0"; }
function cookie(req, n) { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + n + "=([^;]+)")); return m ? m[1] : null; }
const SC = (t, age) => `gs=${t}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;

// 간단한 횟수 제한(D1)
async function limit(env, key, max, ms) {
  const t = now(), r = await env.DB.prepare("SELECT n,exp FROM rl WHERE k=?").bind(key).first();
  if (!r || r.exp < t) { await env.DB.prepare("INSERT OR REPLACE INTO rl(k,n,exp) VALUES(?,1,?)").bind(key, t + ms).run(); return true; }
  if (r.n >= max) return false;
  await env.DB.prepare("UPDATE rl SET n=n+1 WHERE k=?").bind(key).run(); return true;
}
async function user(req, env) {
  const t = cookie(req, "gs"); if (!t || !/^[0-9a-f]{64}$/.test(t)) return null;
  const s = await env.DB.prepare("SELECT u.id,u.email,u.role,u.trial_end FROM s JOIN u ON u.id=s.uid WHERE s.tok=? AND s.exp>?").bind(await sha(t), now()).first();
  return s || null;
}
const active = u => u && (u.role === "owner" || u.role === "member" || u.trial_end > now());

// GitHub Actions OIDC 확인(자료 올리기 전용, 비밀키 없이 저장소·브랜치로만 허용)
let JWKS = null, JWKS_AT = 0;
function b64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function oidc(req, env) {
  const a = req.headers.get("authorization") || ""; const tok = a.startsWith("Bearer ") ? a.slice(7) : ""; const p = tok.split(".");
  if (p.length !== 3) return false;
  const hd = JSON.parse(new TextDecoder().decode(b64u(p[0]))), cl = JSON.parse(new TextDecoder().decode(b64u(p[1])));
  if (hd.alg !== "RS256" || cl.iss !== "https://token.actions.githubusercontent.com" || cl.aud !== "goatstock-web") return false;
  const repos = String(env.REPO || "goatstock/kospi-radar").split(",");
  if (!repos.includes(cl.repository) || cl.ref !== "refs/heads/main" || !(cl.exp * 1000 > now())) return false;
  if (!JWKS || now() - JWKS_AT > 3600000) { JWKS = (await (await fetch("https://token.actions.githubusercontent.com/.well-known/jwks")).json()).keys; JWKS_AT = now(); }
  const jwk = JWKS.find(k => k.kid === hd.kid); if (!jwk) return false;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(p[2]), new TextEncoder().encode(p[0] + "." + p[1]));
}

async function file(env, p) {
  const r = await env.DB.prepare("SELECT b,bin,at FROM f WHERE p=?").bind(p).first(); if (!r) return null;
  const ext = (p.split(".").pop() || "").toLowerCase();
  const body = r.bin ? Uint8Array.from(atob(r.b), c => c.charCodeAt(0)) : r.b;
  return { body, type: TEXT[ext] || "application/octet-stream", at: r.at };
}
async function serveApp(env, name, cache) {
  const f = await file(env, "app/" + name); if (!f) return new Response("준비 중입니다", { status: 404, headers: sec(new Headers({ "content-type": TEXT.txt })) });
  const h = sec(new Headers({ "content-type": f.type, "cache-control": cache || "no-cache" }));
  if (name === "sw.js") h.set("Service-Worker-Allowed", "/");
  return new Response(f.body, { headers: h });
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url), p = u.pathname, ua = req.headers.get("user-agent") || "";
    if (p === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: sec(new Headers({ "content-type": TEXT.txt })) });

    // 자료 올리기(GitHub Actions 전용)
    if (p === "/admin/upload" && req.method === "POST") {
      let ok = false; try { ok = await oidc(req, env); } catch (e) { ok = false; }
      if (!ok) return J({ ok: false }, 403);
      const { files } = await req.json(); const t = now();
      const st = (files || []).filter(x => x && typeof x.p === "string" && /^(app|data|static)\/[\w\-./]+$/.test(x.p) && !x.p.includes("..")).slice(0, 400)
        .map(x => env.DB.prepare("INSERT OR REPLACE INTO f(p,b,bin,at) VALUES(?,?,?,?)").bind(x.p, x.b, x.bin ? 1 : 0, t));
      for (let i = 0; i < st.length; i += 50) await env.DB.batch(st.slice(i, i + 50));
      return J({ ok: true, n: st.length });
    }

    if (AI_BOTS.test(ua) || !ua) return new Response("Forbidden", { status: 403, headers: sec(new Headers({ "content-type": TEXT.txt })) });

    // 로그인·가입
    if (p.startsWith("/api/")) {
      if (req.method === "POST" && !(req.headers.get("origin") || "").startsWith(u.origin)) return J({ ok: false, msg: "잘못된 요청" }, 403);
      if (p === "/api/signup" && req.method === "POST") {
        if (!(await limit(env, "su:" + ip(req), 3, DAY))) return J({ ok: false, msg: "가입 시도가 너무 많습니다. 내일 다시 시도해 주세요." }, 429);
        const b = await req.json().catch(() => ({})); const email = String(b.email || "").trim().toLowerCase(), pw = String(b.pw || "");
        if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(email)) return J({ ok: false, msg: "이메일 형식을 확인해 주세요" }, 400);
        if (pw.length < 8 || pw.length > 128) return J({ ok: false, msg: "비밀번호는 8자 이상으로 정해 주세요" }, 400);
        if (!b.agree) return J({ ok: false, msg: "이용약관과 고지에 동의해 주세요" }, 400);
        if (await env.DB.prepare("SELECT id FROM u WHERE email=?").bind(email).first()) return J({ ok: false, msg: "이미 가입된 이메일입니다. 로그인해 주세요." }, 409);
        const salt = rnd(16), h = await pwHash(pw, salt, env.PEPPER || ""), t = now();
        const role = email === String(env.OWNER_EMAIL || "").toLowerCase() ? "owner" : "trial";
        const r = await env.DB.prepare("INSERT INTO u(email,salt,h,role,created,trial_end,last) VALUES(?,?,?,?,?,?,?)").bind(email, salt, h, role, t, t + TRIAL_MS, t).run();
        const tok = rnd(32); await env.DB.prepare("INSERT INTO s(tok,uid,exp,ua) VALUES(?,?,?,?)").bind(await sha(tok), r.meta.last_row_id, t + 30 * DAY, ua.slice(0, 120)).run();
        return J({ ok: true }, 200, { "set-cookie": SC(tok, 30 * 86400) });
      }
      if (p === "/api/login" && req.method === "POST") {
        const b = await req.json().catch(() => ({})); const email = String(b.email || "").trim().toLowerCase(), pw = String(b.pw || "");
        if (!(await limit(env, "li:" + ip(req), 20, 15 * 60000)) || !(await limit(env, "le:" + email, 10, 15 * 60000))) return J({ ok: false, msg: "로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해 주세요." }, 429);
        const r = await env.DB.prepare("SELECT id,salt,h FROM u WHERE email=?").bind(email).first();
        if (!r || (await pwHash(pw, r.salt, env.PEPPER || "")) !== r.h) return J({ ok: false, msg: "이메일 또는 비밀번호가 맞지 않습니다" }, 401);
        const tok = rnd(32), t = now(); await env.DB.prepare("INSERT INTO s(tok,uid,exp,ua) VALUES(?,?,?,?)").bind(await sha(tok), r.id, t + 30 * DAY, ua.slice(0, 120)).run();
        await env.DB.prepare("UPDATE u SET last=? WHERE id=?").bind(t, r.id).run();
        return J({ ok: true }, 200, { "set-cookie": SC(tok, 30 * 86400) });
      }
      if (p === "/api/logout" && req.method === "POST") { const t = cookie(req, "gs"); if (t) await env.DB.prepare("DELETE FROM s WHERE tok=?").bind(await sha(t)).run(); return J({ ok: true }, 200, { "set-cookie": SC("x", 0) }); }
      if (p === "/api/me") {
        const me = await user(req, env); if (!me) return J({ ok: false }, 401);
        const [a, b] = me.email.split("@");
        return J({ ok: true, email: me.email, mask: a.slice(0, 2) + "***@" + b, role: me.role, trial_end: me.trial_end, active: active(me), now: now(), wm: (await sha(me.id + ":" + (env.PEPPER || ""))).slice(0, 8) });
      }
      return J({ ok: false }, 404);
    }

    // 자료(로그인 + 체험 기간 안에서만)
    if (p.startsWith("/data/") || p.startsWith("/static/") || p.startsWith("/rt/")) {
      const me = await user(req, env); if (!me) return J({ ok: false, login: true }, 401);
      if (!active(me)) return J({ ok: false, ended: true }, 402);
      const day = new Date(now() + 9 * 3600000).toISOString().slice(0, 10);
      await env.DB.prepare("INSERT INTO us(uid,day,n) VALUES(?,?,1) ON CONFLICT(uid,day) DO UPDATE SET n=n+1").bind(me.id, day).run();
      const q = await env.DB.prepare("SELECT n FROM us WHERE uid=? AND day=?").bind(me.id, day).first();
      if (me.role !== "owner" && q && q.n > QUOTA) return J({ ok: false, msg: "오늘 이용 한도를 넘었습니다(자동 수집 방지)" }, 429);
      if (p.startsWith("/rt/")) {
        const r = await env.LIVE.fetch(new Request("https://goatstock-live.internal" + p.slice(3) + u.search, { headers: { "user-agent": "goatstock-web" } }));
        const h = sec(new Headers(r.headers)); h.delete("access-control-allow-origin"); h.set("cache-control", "no-store");
        return new Response(r.body, { status: r.status, headers: h });
      }
      const f = await file(env, p.slice(1)); if (!f) return J({ ok: false }, 404);
      return new Response(f.body, { headers: sec(new Headers({ "content-type": f.type, "cache-control": "private, no-cache", "last-modified": new Date(f.at).toUTCString() })) });
    }

    // 화면
    const name = p === "/" ? "" : p.slice(1);
    if (name === "sw.js") return serveApp(env, "sw.js");
    if (APP_PUBLIC.has(name)) return serveApp(env, name, name.endsWith(".png") ? "public, max-age=86400" : "no-cache");
    if (name === "" || name === "index.html") {
      const me = await user(req, env);
      return serveApp(env, me ? "index.html" : "login.html");
    }
    return new Response("Not found", { status: 404, headers: sec(new Headers({ "content-type": TEXT.txt })) });
  }
};
