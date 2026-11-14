# 자료원 시험 4: 주말에도 도는 '위켄드' 가격(코인 거래소 24시간 파생) 찾기
import urllib.request, json
H = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}
def get(u, data=None):
    try: return urllib.request.urlopen(urllib.request.Request(u, data=data, headers=H), timeout=15).read().decode("utf-8", "ignore")
    except Exception as e: return "ERR " + str(e)
for u in ["https://api.bitget.com/api/v2/mix/market/ticker?symbol=NAS100USDT&productType=USDT-FUTURES",
          "https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES",
          "https://fapi.binance.com/fapi/v1/ticker/price?symbol=NAS100USDT",
          "https://api.bybit.com/v5/market/tickers?category=linear&symbol=NAS100USDT",
          "https://www.okx.com/api/v5/market/ticker?instId=NAS100-USDT-SWAP",
          "https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=NAS100_USDT",
          "https://api.mexc.com/api/v1/contract/ticker?symbol=NAS100_USDT"]:
    t = get(u)
    if "tickers?productType" in u and not t.startswith("ERR"):
        try:
            L = json.loads(t)["data"]; print("BITGET 전체", len(L), [ (x["symbol"], x["lastPr"]) for x in L if any(k in x["symbol"] for k in ["NAS","SPX","US500","XAU","WTI","OIL","BRENT","EWY","KOSPI","NDX","US100","USOIL","UKOIL","XAG","GOLD"]) ][:40])
        except Exception as e: print("BITGET 파싱", e, t[:200])
    else: print(u, "\n   ", t[:300])
t = get("https://api.hyperliquid.xyz/info", json.dumps({"type": "allMids", "dex": "xyz"}).encode())
print("HL xyz", t[:800])
t = get("https://api.hyperliquid.xyz/info", json.dumps({"type": "perpDexs"}).encode())
print("HL dexs", t[:600])
