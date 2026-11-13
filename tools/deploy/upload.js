// GitHub Actions에서 실행: 바뀐 화면·자료 파일을 GOAT STOCK 웹 서버(D1)로 올린다. 비밀키 없음(OIDC).
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const URL_ = process.env.GS_URL || "https://goatstock-web.ppopposs22.workers.dev";
const APP = ["index.html", "login.html", "terms.html", "sw.js", "manifest.json", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "logo.png", "logo-t.png", "wordmark.png"];
function walk(d) { return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : []; }
(async () => {
  const r = await fetch(process.env.ACTIONS_ID_TOKEN_REQUEST_URL + "&audience=goatstock-web", { headers: { authorization: "bearer " + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN } });
  const tok = (await r.json()).value;
  let list;
  const full = process.env.FULL === "1";
  if (!full) {
    try { list = execSync(`git diff --name-only ${process.env.BEFORE} ${process.env.AFTER}`).toString().split("\n").filter(Boolean); }
    catch (e) { list = null; }
  }
  if (!list) list = [...APP, ...walk("data"), ...walk("static")];
  const items = [];
  for (const f of list) {
    if (!fs.existsSync(f)) continue;
    let key = null;
    if (APP.includes(f)) key = "app/" + f; else if (/^(data|static)\//.test(f)) key = f; else continue;
    if (/\.zip$|_bak|\.tmp$/.test(f)) continue;
    const bin = /\.png$/.test(f), buf = fs.readFileSync(f);
    items.push({ p: key, b: bin ? buf.toString("base64") : buf.toString("utf8"), bin: bin ? 1 : 0, n: buf.length });
  }
  console.log("올릴 파일", items.length);
  let batch = [], size = 0, sent = 0;
  const send = async () => {
    if (!batch.length) return;
    for (let k = 0; k < 3; k++) {
      const res = await fetch(URL_ + "/admin/upload", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify({ files: batch.map(({ p, b, bin }) => ({ p, b, bin })) }) });
      const t = await res.text(); if (res.ok) { sent += batch.length; break; } console.log("재시도", res.status, t.slice(0, 200)); if (k === 2) throw new Error("upload failed " + res.status);
      await new Promise(z => setTimeout(z, 3000));
    }
    batch = []; size = 0;
  };
  for (const it of items) { if (size + it.n > 3e6 || batch.length >= 200) await send(); batch.push(it); size += it.n; }
  await send();
  console.log("완료", sent);
})().catch(e => { console.error(e); process.exit(1); });
