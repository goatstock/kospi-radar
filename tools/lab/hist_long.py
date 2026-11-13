# 장기 일봉 수집(연구용, 2026-11-14 회장님 지시): MODE=kr20 → 국내 20년(2005~), MODE=us10 → 미국 S&P500 10년.
# 결과는 Actions 산출물(3일 보관)로만 남기고 저장소에 올리지 않는다. 시세 조회만, 주문 없음.
import os, json, gzip, csv, time, sys, urllib.request, concurrent.futures as cf
MODE = os.environ.get("MODE", "kr20")
def get(url, h, tries=3):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=25) as r: return json.loads(r.read().decode("utf-8"))
        except Exception as e: time.sleep(2 * (k + 1)); err = e
    print("실패", url[:90], err); return None
n = 0
if MODE == "kr20":
    H = {"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"}
    S, E = "200501010000", "202612310000"
    codes = [r[0] for r in json.load(open("data/KR/index.json", encoding="utf-8"))["rows"]]
    def one(c):
        j = get(f"https://api.stock.naver.com/chart/domestic/item/{c}/day?startDateTime={S}&endDateTime={E}", H); time.sleep(0.12)
        return [[c, x.get("localDate"), x.get("openPrice"), x.get("highPrice"), x.get("lowPrice"), x.get("closePrice"), x.get("accumulatedTradingVolume"), x.get("foreignRetentionRate")] for x in (j or [])]
    with gzip.open("kr_daily_20y.csv.gz", "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["code", "date", "open", "high", "low", "close", "volume", "frgn_rate"])
        with cf.ThreadPoolExecutor(6) as ex:
            for i, rs in enumerate(ex.map(one, codes)):
                w.writerows(rs); n += len(rs)
                if i % 200 == 0: print(i, n, flush=True)
    idx = {k: [[x.get("localDate"), x.get("openPrice"), x.get("highPrice"), x.get("lowPrice"), x.get("closePrice"), x.get("accumulatedTradingVolume")] for x in (get(f"https://api.stock.naver.com/chart/domestic/index/{k}/day?startDateTime={S}&endDateTime={E}", H) or [])] for k in ["KOSPI", "KOSDAQ"]}
    json.dump(idx, gzip.open("kr_index_20y.json.gz", "wt", encoding="utf-8"))
    print("완료 행", n, {k: (len(v), v[0][0] if v else None) for k, v in idx.items()})
else:
    H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"}
    tick = [r[0] for r in json.load(open("data/US/index.json", encoding="utf-8"))["rows"]]
    def yh(t):
        j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{t.replace('.', '-')}?period1=1104537600&period2=1800000000&interval=1d&events=div%2Csplit", H); time.sleep(0.2)
        try:
            r = j["chart"]["result"][0]; q = r["indicators"]["quote"][0]; adj = r["indicators"].get("adjclose", [{}])[0].get("adjclose")
            return [[t, ts, q["open"][i], q["high"][i], q["low"][i], q["close"][i], q["volume"][i], adj[i] if adj else None] for i, ts in enumerate(r["timestamp"])]
        except Exception: return []
    with gzip.open("us_daily_20y.csv.gz", "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["code", "ts", "open", "high", "low", "close", "volume", "adjclose"])
        with cf.ThreadPoolExecutor(4) as ex:
            for i, rs in enumerate(ex.map(yh, tick + ["^GSPC", "^NDX", "^VIX", "^TNX"])):
                w.writerows(rs); n += len(rs)
                if i % 100 == 0: print(i, n, flush=True)
    print("완료 행", n)
if n < 100000: sys.exit("자료가 너무 적음")
