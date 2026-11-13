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
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
json.dump({"date": now.strftime("%Y-%m-%d"), "made": now.strftime("%Y-%m-%d %H:%M"), "src": "네이버 증권 업종", "rows": rows}, open("static/sector_kr.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("업종", len(rows)); print("JSON>" + open("static/sector_kr.json").read())
