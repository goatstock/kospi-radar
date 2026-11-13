# 국내 업종별 등락 (네이버 업종 시세) → static/sector_kr.json  (고트스톡, 2026-11-13)
# 화면 왼쪽 '업종 지도' 배너용. 수집만 하고 판단·추천은 하지 않는다.
import re, json, time, datetime, urllib.request, html
U = "https://finance.naver.com/sise/sise_group.naver?type=upjong"
req = urllib.request.Request(U, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", "Referer": "https://finance.naver.com/"})
raw = urllib.request.urlopen(req, timeout=30).read()
try: t = raw.decode("euc-kr")
except UnicodeDecodeError: t = raw.decode("cp949", "ignore")
rows = []
for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
    m = re.search(r'sise_group_detail\.naver\?type=upjong&(?:amp;)?no=(\d+)"[^>]*>(.*?)</a>', tr, re.S)
    if not m: continue
    tds = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
    nums = [x.replace(",", "").replace("%", "") for x in tds[1:]]
    nums = [x for x in nums if re.fullmatch(r"[+-]?\d+(\.\d+)?", x)]
    if len(nums) < 5: continue
    pct = float(nums[0]); tot, up, fl, dn = (int(float(x)) for x in nums[1:5])
    rows.append([m.group(1), html.unescape(m.group(2)).strip(), pct, up, fl, dn, tot])
if len(rows) < 30:
    print("데스크톱 페이지 파싱 실패", len(raw), repr(t[:300]), "detail링크수", t.count("sise_group_detail"))
    i = t.find("sise_group_detail"); print("주변:", repr(t[max(0, i-600):i+900]))
    for u in ["https://m.stock.naver.com/api/stocks/industry?page=1&pageSize=100", "https://m.stock.naver.com/api/stocks/industry/list?page=1&pageSize=100"]:
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20).read().decode("utf-8", "ignore"); print("모바일", u, repr(r[:1500]))
        except Exception as e: print("모바일 실패", u, e)
    raise SystemExit(f"업종 행이 너무 적음: {len(rows)}")
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
json.dump({"date": now.strftime("%Y-%m-%d"), "made": now.strftime("%Y-%m-%d %H:%M"), "src": "네이버 업종 시세", "rows": rows}, open("static/sector_kr.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("업종", len(rows)); print("JSON>" + open("static/sector_kr.json").read())
