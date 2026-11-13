# 자료원 시험: 코스피200 야간선물(KRX 야간 파생시장) 시세를 주는 공개 주소 찾기
import urllib.request, json
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", "Referer": "https://m.stock.naver.com/"}
U = [
 "https://m.stock.naver.com/api/index/FUT/basic",
 "https://m.stock.naver.com/api/index/FUT/integration",
 "https://m.stock.naver.com/api/index/NFUT/basic",
 "https://m.stock.naver.com/api/index/FUTN/basic",
 "https://m.stock.naver.com/api/index/FUT_NIGHT/basic",
 "https://m.stock.naver.com/api/futures/FUT/basic",
 "https://polling.finance.naver.com/api/realtime/domestic/index/NFUT",
 "https://polling.finance.naver.com/api/realtime/domestic/futures/FUT",
 "https://api.stock.naver.com/index/FUT/basic",
 "https://api.stock.naver.com/chart/domestic/index/FUT/minute?startDateTime=202611131800&endDateTime=202611140600",
 "https://m.stock.naver.com/front-api/marketIndex/productDetail?category=futures&reutersCode=FUT",
 "https://finance.daum.net/api/quotes/A101W6000?summary=false",
 "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS200?range=1d&interval=5m",
 "https://api.investing.com/api/financialdata/1166160/historical/chart/?period=P1D&interval=PT5M&pointscount=60",
 "https://stooq.com/q/l/?s=kospi200.f&f=sd2t2ohlcv&h&e=json",
]
for u in U:
    try:
        req = urllib.request.Request(u, headers=H if "daum" not in u else {**H, "Referer": "https://finance.daum.net/"})
        r = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
        print("OK ", u, "\n    ", r[:600].replace("\n", " "))
    except Exception as e:
        print("ERR", u, e)
