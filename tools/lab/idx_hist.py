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
NV = {"^KS11": "KOSPI", "^KQ11": "KOSDAQ", "^KS200": "KPI200"}
NH = {"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"}
def naver(code):  # 국내 지수는 앱의 다른 숫자와 맞도록 네이버 자료를 쓴다
    t = datetime.datetime.utcnow() + datetime.timedelta(hours=9); e = t.strftime("%Y%m%d"); s0 = (t - datetime.timedelta(days=740)).strftime("%Y%m%d")
    j = None
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(f"https://api.stock.naver.com/chart/domestic/index/{code}/day?startDateTime={s0}0000&endDateTime={e}2359", headers=NH), timeout=20) as r: j = json.loads(r.read().decode()); break
        except Exception: time.sleep(2)
    d = [[f"{x['localDate'][:4]}-{x['localDate'][4:6]}-{x['localDate'][6:]}", x["openPrice"], x["highPrice"], x["lowPrice"], x["closePrice"]] for x in (j or []) if x.get("closePrice")]
    m = []
    if d:
        day = d[-1][0].replace("-", "")
        try:
            with urllib.request.urlopen(urllib.request.Request(f"https://api.stock.naver.com/chart/domestic/index/{code}/minute?startDateTime={day}0900&endDateTime={day}1530", headers=NH), timeout=20) as r: mj = json.loads(r.read().decode())
            cur = None
            for x in mj:
                hm = x["localDateTime"][8:12]; k5 = f"{hm[:2]}:{int(hm[2:]) // 5 * 5:02d}"; c = x["currentPrice"]; o = x.get("openPrice") or c; h = x.get("highPrice") or c; l = x.get("lowPrice") or c
                if not cur or cur[0] != k5:
                    if cur: m.append(cur)
                    cur = [k5, o, h, l, c]
                else: cur[2] = max(cur[2], h); cur[3] = min(cur[3], l); cur[4] = c
            if cur: m.append(cur)
        except Exception as ex: print("분봉 실패", code, ex)
    return d, m
D = {}
for s, n in SY.items():
    if s in NV:
        d, m = naver(NV[s])
        if d: D[s] = {"n": n, "d": d, "m": m}; continue
    d = bars(s, "2y", "1d", "%Y-%m-%d"); m = bars(s, "1d", "5m", "%H:%M"); time.sleep(0.3)
    if d: D[s] = {"n": n, "d": d, "m": m}
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
json.dump({"made": now.strftime("%Y-%m-%d %H:%M"), "src": "Yahoo Finance(지연 시세)", "s": D}, open("static/idx_hist.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("지수", len(D), {k: (len(v["d"]), len(v["m"])) for k, v in D.items()})
if len(D) < 5: raise SystemExit("지수 자료가 너무 적음")
