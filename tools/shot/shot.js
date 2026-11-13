// 첫 화면 노트북 속 '실제 화면'을 매일 장 마감 뒤 새로 찍는다 (GitHub Actions)
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem("goat_tour", "1"); localStorage.setItem("goat_seen_v", JSON.stringify("2026.11.13 · 개선 100회")); localStorage.setItem("gs_trial_start", String(Date.now())); localStorage.setItem("m_theme", "light"); });
  await p.goto("http://localhost:8811/index.html"); await p.waitForTimeout(7000);
  await p.evaluate(() => { const s = document.getElementById("staleb"); if (s) s.remove(); document.querySelectorAll(".night .ixs").forEach(e => { if (/불러오는/.test(e.textContent)) e.textContent = "실시간 · 로그인 후 표시"; }); });
  await p.screenshot({ path: process.argv[2], clip: { x: 0, y: 0, width: 1440, height: 900 } }); await b.close();
})();
