# 미국 S&P500 분봉(장 마감 뒤 하루치) → data/live_us/{티커}.json  (고트스톡, 2026-11-14)
# 시세 조회만. 앱의 '분봉' 버튼용. 상승·하락 조건 표시는 아직 없음(국내 분봉만 검증 중).
import json, os, time, datetime, urllib.request, concurrent.futures as cf
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"}
tick = [r[0] for r in json.load(open("data/US/index.json", encoding="utf-8"))["rows"]]
TFS = [1, 3, 5, 10, 15, 30]
os.makedirs("data/live_us", exist_ok=True)
def get(u):
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=20) as r: return json.loads(r.read().decode())
        except Exception: time.sleep(2 * (k + 1))
    return None
def one(t):
    j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{t.replace('.', '-')}?range=1d&interval=1m"); time.sleep(0.15)
    try:
        r = j["chart"]["result"][0]; q = r["indicators"]["quote"][0]; off = r["meta"].get("gmtoffset", -18000)
    except Exception: return 0
    bars = []
    for i, ts in enumerate(r.get("timestamp") or []):
        o, h, l, c, v = q["open"][i], q["high"][i], q["low"][i], q["close"][i], q["volume"][i] or 0
        if None in (o, h, l, c): continue
        bars.append([ts + off, o, h, l, c, v])
    if len(bars) < 20: return 0
    day = datetime.datetime.utcfromtimestamp(bars[0][0]).strftime("%Y-%m-%d")
    out = {"code": t, "day": day, "m": "US", "tz": "뉴욕 시간", "tf": {}, "judge": []}
    for tf in TFS:
        agg, cur, pv, vv = [], None, 0.0, 0.0
        for b in bars:
            k = b[0] - b[0] % (tf * 60)
            if not cur or cur[0] != k:
                if cur: agg.append(cur)
                cur = [k, b[1], b[2], b[3], b[4], b[5]]
            else: cur[2] = max(cur[2], b[2]); cur[3] = min(cur[3], b[3]); cur[4] = b[4]; cur[5] += b[5]
        agg.append(cur)
        rows = []
        for a in agg:
            pv += (a[2] + a[3] + a[4]) / 3 * a[5]; vv += a[5]
            rows.append([datetime.datetime.utcfromtimestamp(a[0]).strftime("%H:%M"), round(a[1], 4), round(a[2], 4), round(a[3], 4), round(a[4], 4), a[5], round(pv / vv, 4) if vv else round(a[4], 4), "", ""])
        out["tf"][str(tf)] = rows
    json.dump(out, open(f"data/live_us/{t}.json", "w"), separators=(",", ":"))
    return 1
with cf.ThreadPoolExecutor(6) as ex: n = sum(ex.map(one, tick))
print("미국 분봉", n, "종목")
if n < 100: raise SystemExit("너무 적음")
