# 국내 업종별 등락 (네이버 증권 업종 목록) → static/sector_kr.json  (고트스톡, 2026-11-13)
# 화면 왼쪽 '업종 지도' 배너용. 수집만 하고 판단·추천은 하지 않는다.
import json, datetime, urllib.request
rows, page = [], 1
while page < 6:
    u = f"https://m.stock.naver.com/api/stocks/industry?page={page}&pageSize=100"
    d = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"}), timeout=30).read().decode("utf-8"))
    g = d.get("groups") or []
    for x in g:
        rows.append([str(x["no"]), x["name"], round(float(x["changeRate"]), 2), int(x.get("riseCount") or 0), int(x.get("steadyCount") or 0), int(x.get("fallCount") or 0), int(x.get("totalCount") or 0)])
    if len(g) < 100: break
    page += 1
if len(rows) < 30: raise SystemExit(f"업종 행이 너무 적음: {len(rows)}")
# 업종별 종목(등락 큰 순 상위) — 업종 상자를 누르면 보여 줌. 실패해도 업종 지도는 그대로 낸다.
mem = {}
def members(no):
    for u in [f"https://m.stock.naver.com/api/stocks/industry/{no}?page=1&pageSize=100", f"https://m.stock.naver.com/api/stocks/industry/{no}/list?page=1&pageSize=100"]:
        try:
            j = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20).read().decode("utf-8"))
        except Exception: continue
        L = j.get("stocks") if isinstance(j, dict) else j
        if not L: continue
        out = []
        for x in L:
            c = x.get("itemCode") or x.get("code"); n = x.get("stockName") or x.get("name")
            r = x.get("fluctuationsRatio") or x.get("changeRate")
            v = x.get("accumulatedTradingValue") or x.get("accumulatedTradingValueRaw") or 0
            try: out.append([str(c), n, round(float(str(r).replace(",", "")), 2), float(str(v).replace(",", "") or 0)])
            except Exception: pass
        if out: return out
    return None
try:
    first = members(rows[0][0])
    print("업종 종목 샘플", first[:3] if first else None)
    if first:
        for r in sorted(rows, key=lambda r: -r[6])[:40]:
            m_ = members(r[0])
            if m_: mem[r[0]] = [x[:3] for x in sorted(m_, key=lambda x: -x[3])[:12]]
except Exception as e: print("업종 종목 실패", e)
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
json.dump({"date": now.strftime("%Y-%m-%d"), "made": now.strftime("%Y-%m-%d %H:%M"), "src": "네이버 증권 업종", "rows": rows, "mem": mem}, open("static/sector_kr.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("업종", len(rows), "종목 붙은 업종", len(mem))
