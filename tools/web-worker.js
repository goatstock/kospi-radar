// GOAT STOCK 웹 서버 (Cloudflare Worker + D1) — 2026-11-13
// 목적: 앱 화면·자료를 로그인한 사람에게만 서버에서 내보낸다(공개 저장소에 자료 원본을 두지 않음).
// 바인딩: DB(D1 goatstock), LIVE(서비스: goatstock-live), OWNER_EMAIL(평문), PEPPER(비밀), REPO(평문, 예: goatstock/kospi-radar)
// 가입 이메일 인증(11-14 오실장 결정): MAIL_KEY(비밀, Brevo API 키)·MAIL_FROM(평문, Brevo에서 확인된 보내는 주소)이 있으면 켜짐. 없으면 예전처럼 바로 체험 시작.
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
async function vTable(env) { await env.DB.prepare("CREATE TABLE IF NOT EXISTS v(email TEXT PRIMARY KEY, h TEXT, exp INTEGER, n INTEGER DEFAULT 0)").run(); }
async function sendCode(env, email) {  // 6자리 인증 번호. 저장은 해시로만.
  await vTable(env); const a = new Uint32Array(1); crypto.getRandomValues(a); const code = String(a[0] % 1000000).padStart(6, "0");
  await env.DB.prepare("INSERT INTO v(email,h,exp,n) VALUES(?,?,?,0) ON CONFLICT(email) DO UPDATE SET h=excluded.h,exp=excluded.exp,n=0").bind(email, await sha(code + ":" + email + ":" + (env.PEPPER || "")), now() + 10 * 60000).run();
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": env.MAIL_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: env.MAIL_FROM, name: "GOAT STOCK" }, to: [{ email }], subject: `[GOAT STOCK] 인증 번호 ${code}`,
        htmlContent: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6"><b>GOAT STOCK 가입 인증 번호</b><p style="font-size:28px;letter-spacing:6px;font-weight:800;margin:12px 0">${code}</p><p>10분 안에 가입 화면에 입력해 주세요. 본인이 가입하지 않았다면 이 메일은 무시하셔도 됩니다.</p></div>` }) });
    return r.ok;
  } catch (e) { return false; }
}
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
        if (role !== "owner" && env.MAIL_KEY && env.MAIL_FROM) {  // 이메일 인증을 거쳐야 체험이 시작됨(체험 반복 가입 방지)
          await env.DB.prepare("INSERT INTO u(email,salt,h,role,created,trial_end,last) VALUES(?,?,?,?,?,?,?)").bind(email, salt, h, "pending", t, 0, t).run();
          const sent = await sendCode(env, email);
          return J({ ok: true, verify: true, msg: sent ? "인증 번호를 이메일로 보냈습니다. 10분 안에 입력해 주세요." : "인증 메일을 보내지 못했습니다. 잠시 뒤 '다시 보내기'를 눌러 주세요." });
        }
        const r = await env.DB.prepare("INSERT INTO u(email,salt,h,role,created,trial_end,last) VALUES(?,?,?,?,?,?,?)").bind(email, salt, h, role, t, t + TRIAL_MS, t).run();
        const tok = rnd(32); await env.DB.prepare("INSERT INTO s(tok,uid,exp,ua) VALUES(?,?,?,?)").bind(await sha(tok), r.meta.last_row_id, t + 30 * DAY, ua.slice(0, 120)).run();
        return J({ ok: true }, 200, { "set-cookie": SC(tok, 30 * 86400) });
      }
      if (p === "/api/verify" && req.method === "POST") {
        const b = await req.json().catch(() => ({})); const email = String(b.email || "").trim().toLowerCase(), code = String(b.code || "").replace(/\D/g, "");
        if (!(await limit(env, "vf:" + ip(req), 30, 15 * 60000))) return J({ ok: false, msg: "시도가 너무 많습니다. 15분 뒤 다시 해 주세요." }, 429);
        await vTable(env); const v = await env.DB.prepare("SELECT h,exp,n FROM v WHERE email=?").bind(email).first();
        if (!v || v.exp < now() || v.n >= 5) return J({ ok: false, msg: "인증 번호가 만료됐습니다. '다시 보내기'를 눌러 주세요." }, 400);
        if ((await sha(code + ":" + email + ":" + (env.PEPPER || ""))) !== v.h) { await env.DB.prepare("UPDATE v SET n=n+1 WHERE email=?").bind(email).run(); return J({ ok: false, msg: "인증 번호가 맞지 않습니다" }, 400); }
        const usr = await env.DB.prepare("SELECT id,role FROM u WHERE email=?").bind(email).first(); if (!usr) return J({ ok: false, msg: "가입 정보가 없습니다" }, 400);
        const t = now(); if (usr.role === "pending") await env.DB.prepare("UPDATE u SET role='trial',trial_end=?,last=? WHERE id=?").bind(t + TRIAL_MS, t, usr.id).run();
        await env.DB.prepare("DELETE FROM v WHERE email=?").bind(email).run();
        const tok = rnd(32); await env.DB.prepare("INSERT INTO s(tok,uid,exp,ua) VALUES(?,?,?,?)").bind(await sha(tok), usr.id, t + 30 * DAY, ua.slice(0, 120)).run();
        return J({ ok: true }, 200, { "set-cookie": SC(tok, 30 * 86400) });
      }
      if (p === "/api/resend" && req.method === "POST") {
        const b = await req.json().catch(() => ({})); const email = String(b.email || "").trim().toLowerCase();
        if (!(await limit(env, "rs:" + ip(req), 5, DAY)) || !(await limit(env, "re:" + email, 3, DAY))) return J({ ok: false, msg: "오늘은 더 보낼 수 없습니다. 내일 다시 해 주세요." }, 429);
        const usr = await env.DB.prepare("SELECT role FROM u WHERE email=?").bind(email).first();
        if (!usr || usr.role !== "pending" || !env.MAIL_KEY) return J({ ok: true, msg: "인증이 필요한 계정이면 메일을 보냈습니다." });
        await sendCode(env, email); return J({ ok: true, msg: "인증 번호를 다시 보냈습니다." });
      }
      if (p === "/api/login" && req.method === "POST") {
        const b = await req.json().catch(() => ({})); const email = String(b.email || "").trim().toLowerCase(), pw = String(b.pw || "");
        if (!(await limit(env, "li:" + ip(req), 20, 15 * 60000)) || !(await limit(env, "le:" + email, 10, 15 * 60000))) return J({ ok: false, msg: "로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해 주세요." }, 429);
        const r = await env.DB.prepare("SELECT id,salt,h,role FROM u WHERE email=?").bind(email).first();
        if (!r || (await pwHash(pw, r.salt, env.PEPPER || "")) !== r.h) return J({ ok: false, msg: "이메일 또는 비밀번호가 맞지 않습니다" }, 401);
        if (r.role === "pending") return J({ ok: true, verify: true, msg: "이메일 인증을 마쳐야 체험이 시작됩니다. 메일의 인증 번호를 넣어 주세요(안 왔으면 다시 보내기)." });
        const tok = rnd(32), t = now(); await env.DB.prepare("INSERT INTO s(tok,uid,exp,ua) VALUES(?,?,?,?)").bind(await sha(tok), r.id, t + 30 * DAY, ua.slice(0, 120)).run();
        await env.DB.prepare("UPDATE u SET last=? WHERE id=?").bind(t, r.id).run();
        return J({ ok: true }, 200, { "set-cookie": SC(tok, 30 * 86400) });
      }
      if (p === "/api/logout" && req.method === "POST") { const t = cookie(req, "gs"); if (t) await env.DB.prepare("DELETE FROM s WHERE tok=?").bind(await sha(t)).run(); return J({ ok: true }, 200, { "set-cookie": SC("x", 0) }); }
      if (p.startsWith("/api/chat")) {  // 11-14 회장님 지시 채팅(시안): 로그인·이용 중 회원만, 투자 권유·홍보·연락처 차단, 신고 3번이면 숨김, 7일 보관
        const me = await user(req, env); if (!me || !active(me)) return J({ ok: false, msg: "로그인한 회원만 쓸 수 있습니다" }, 401);
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS c(id INTEGER PRIMARY KEY AUTOINCREMENT, uid INTEGER, nick TEXT, txt TEXT, at INTEGER, rep INTEGER DEFAULT 0, hid INTEGER DEFAULT 0)").run();
        const nick = me.role === "owner" ? "운영자" : "투자자" + (await sha(me.id + ":" + (env.PEPPER || ""))).slice(0, 4).toUpperCase();
        if (p === "/api/chat" && req.method === "GET") {
          const after = Number(u.searchParams.get("after") || 0) || 0;
          const r = await env.DB.prepare("SELECT id,nick,txt,at,uid FROM c WHERE id>? AND hid=0 AND at>? ORDER BY id DESC LIMIT 60").bind(after, now() - 7 * DAY).all();
          return J({ ok: true, me: nick, owner: me.role === "owner", rows: (r.results || []).reverse().map(x => [x.id, x.nick, x.txt, x.at, x.uid === me.id]) });
        }
        if (p === "/api/chat" && req.method === "POST") {
          if (!(await limit(env, "ch:" + me.id, 6, 60000)) || !(await limit(env, "chd:" + me.id, 300, DAY))) return J({ ok: false, msg: "너무 빨리 보내고 있습니다. 잠시 뒤 다시 보내 주세요." }, 429);
          const b = await req.json().catch(() => ({})); const txt = String(b.txt || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);
          if (!txt) return J({ ok: false, msg: "내용을 입력해 주세요" }, 400);
          if (/https?:|www\.|\.(com|kr|net|io|gg|me|ly)\b|open\.kakao|카톡|카카오톡|텔레|telegram|t\.me|밴드|리딩|유료\s*방|vip\s*방|수익\s*(보장|확정)|무조건\s*(오|상승|수익)|원금\s*보장|문의\s*주|010[-\s]?\d{3,4}|\d{2,3}[-\s]\d{3,4}[-\s]\d{4}/i.test(txt))
            return J({ ok: false, msg: "링크·연락처·리딩방 홍보·수익 보장 같은 글은 올릴 수 없습니다" }, 400);
          await env.DB.prepare("INSERT INTO c(uid,nick,txt,at) VALUES(?,?,?,?)").bind(me.id, nick, txt, now()).run();
          await env.DB.prepare("DELETE FROM c WHERE at<?").bind(now() - 7 * DAY).run();
          return J({ ok: true });
        }
        if (p === "/api/chat/report" && req.method === "POST") {
          const b = await req.json().catch(() => ({})); const id = Number(b.id) || 0;
          if (!(await limit(env, "cr:" + me.id + ":" + id, 1, 7 * DAY))) return J({ ok: true, msg: "이미 신고했습니다" });
          await env.DB.prepare("UPDATE c SET rep=rep+1, hid=CASE WHEN rep+1>=3 THEN 1 ELSE hid END WHERE id=?").bind(id).run();
          return J({ ok: true, msg: "신고했습니다. 3번 이상 신고되면 숨겨집니다." });
        }
        if (p === "/api/chat/del" && req.method === "POST") {
          const b = await req.json().catch(() => ({})); const id = Number(b.id) || 0;
          if (me.role === "owner") await env.DB.prepare("UPDATE c SET hid=1 WHERE id=?").bind(id).run(); else await env.DB.prepare("UPDATE c SET hid=1 WHERE id=? AND uid=?").bind(id, me.id).run();
          return J({ ok: true });
        }
        return J({ ok: false }, 404);
      }
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
