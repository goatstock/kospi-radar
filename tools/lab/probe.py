# 자료원 시험 3: 실시간 시세 지연 확인(야후 지연 분, 네이버 해외 지수·선물 실시간 주소)
import urllib.request, json, time
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", "Referer": "https://m.stock.naver.com/"}
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=15).read().decode("utf-8", "ignore")
    except Exception as e: return "ERR " + str(e)
now = time.time()
for s in ["NQ=F", "ES=F", "YM=F", "^GSPC", "^IXIC", "^DJI", "^SOX", "^NDX", "KRW=X", "CL=F"]:
    t = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(s)}?range=1d&interval=1m")
    try:
        m = json.loads(t)["chart"]["result"][0]["meta"]
        print("YH", s, m.get("regularMarketPrice"), "prev", m.get("chartPreviousClose"), m.get("previousClose"), "delay", m.get("exchangeDataDelayedBy"), "age(s)", int(now - (m.get("regularMarketTime") or 0)), m.get("exchangeName"))
    except Exception as e: print("YH", s, t[:150])
for u in ["https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC", "https://polling.finance.naver.com/api/realtime/worldstock/index/.INX",
          "https://polling.finance.naver.com/api/realtime/worldstock/index/.SOX", "https://polling.finance.naver.com/api/realtime/worldstock/index/.DJI",
          "https://m.stock.naver.com/api/index/.IXIC/basic", "https://api.stock.naver.com/index/.IXIC/basic",
          "https://polling.finance.naver.com/api/realtime/worldstock/futures/NQcv1", "https://api.stock.naver.com/futures/NQcv1/basic",
          "https://m.stock.naver.com/api/futures/NQcv1/basic", "https://api.stock.naver.com/futures/nationType/USA",
          "https://m.stock.naver.com/front-api/marketIndex/productDetail?category=futures&reutersCode=NQcv1",
          "https://api.stock.naver.com/marketindex/futures/NQcv1", "https://m.stock.naver.com/front-api/futures/NQcv1/basic"]:
    print("NV", u, "\n   ", get(u)[:500].replace("\n", " "))
