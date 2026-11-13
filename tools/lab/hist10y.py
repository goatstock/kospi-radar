# 10년 일봉 수집(연구용): 네이버 공개 차트 자료. 결과는 Actions 산출물(1일 보관)로만 남기고 저장소에 올리지 않는다.
import json, gzip, csv, time, sys, urllib.request, concurrent.futures as cf
H = {"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"}
S, E = "201511010000", "202611140000"
def get(url, tries=3):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=20) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            time.sleep(1.5 * (k + 1)); err = e
    print("실패", url, err); return None
rows = json.load(open("data/KR/index.json", encoding="utf-8"))["rows"]
codes = [r[0] for r in rows]
print("종목", len(codes))
def one(c):
    j = get(f"https://api.stock.naver.com/chart/domestic/item/{c}/day?startDateTime={S}&endDateTime={E}")
    out = []
    for x in j or []:
        out.append([c, x.get("localDate"), x.get("openPrice"), x.get("highPrice"), x.get("lowPrice"), x.get("closePrice"), x.get("accumulatedTradingVolume"), x.get("foreignRetentionRate")])
    time.sleep(0.15); return out
n = 0
with gzip.open("kr_daily_10y.csv.gz", "wt", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["code", "date", "open", "high", "low", "close", "volume", "frgn_rate"])
    with cf.ThreadPoolExecutor(6) as ex:
        for i, rs in enumerate(ex.map(one, codes)):
            w.writerows(rs); n += len(rs)
            if i % 100 == 0: print(i, n, flush=True)
idx = {}
for k in ["KOSPI", "KOSDAQ", "KPI200"]:
    j = get(f"https://api.stock.naver.com/chart/domestic/index/{k}/day?startDateTime={S}&endDateTime={E}")
    idx[k] = [[x.get("localDate"), x.get("openPrice"), x.get("highPrice"), x.get("lowPrice"), x.get("closePrice"), x.get("accumulatedTradingVolume")] for x in (j or [])]
json.dump(idx, gzip.open("kr_index_10y.json.gz", "wt", encoding="utf-8"))
print("완료 행", n, {k: len(v) for k, v in idx.items()})
if n < 100000: sys.exit("자료가 너무 적음")
