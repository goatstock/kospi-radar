# 지수 차트 자료(일봉 2년 + 최근 거래일 5분봉) → static/idx_hist.json  (고트스톡, 2026-11-14)
# 메인 화면 지수 칸을 누르면 차트를 보여 주기 위한 것. 시세 조회만.
import json, time, datetime, urllib.request
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"}
SY = {"^KS11": "코스피", "^KQ11": "코스닥", "^KS200": "코스피200", "^GSPC": "S&P500", "^IXIC": "나스닥", "^DJI": "다우", "^SOX": "반도체(SOX)", "NQ=F": "나스닥 선물", "ES=F": "S&P500 선물", "KRW=X": "원/달러"}
def get(u):
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=20) as r: return json.loads(r.read().decode())
        except Exception: time.sleep(2 * (k + 1))
    return None
def bars(sym, rng, itv, fmt):
    j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}?range={rng}&interval={itv}")
    try:
        r = j["chart"]["result"][0]; q = r["indicators"]["quote"][0]; off = r["meta"].get("gmtoffset", 0)
    except Exception: return []
    out = []
    for i, ts in enumerate(r.get("timestamp") or []):
        o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        if None in (o, h, l, c): continue
        out.append([datetime.datetime.utcfromtimestamp(ts + off).strftime(fmt), round(o, 2), round(h, 2), round(l, 2), round(c, 2)])
    return out
D = {}
for s, n in SY.items():
    d = bars(s, "2y", "1d", "%Y-%m-%d"); m = bars(s, "1d", "5m", "%H:%M"); time.sleep(0.3)
    if d: D[s] = {"n": n, "d": d, "m": m}
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
json.dump({"made": now.strftime("%Y-%m-%d %H:%M"), "src": "Yahoo Finance(지연 시세)", "s": D}, open("static/idx_hist.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("지수", len(D), {k: (len(v["d"]), len(v["m"])) for k, v in D.items()})
if len(D) < 5: raise SystemExit("지수 자료가 너무 적음")
