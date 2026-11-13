# 외국인·기관 순매수(주) 10년치 캐시를 최신으로 이어 붙인다 (매일 AI 순위 계산 전에 실행)
# 캐시: flowcache/kr_flow_10y.csv.gz (GitHub Actions 캐시에만 보관, 저장소에 안 올림)
import os, json, gzip, time, datetime, urllib.request, concurrent.futures as cf
import pandas as pd
H = {"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"}
P = "flowcache/kr_flow_10y.csv.gz"; PS = 60
def get(u):
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=20) as r: return json.loads(r.read().decode())
        except Exception: time.sleep(1.5 * (k + 1))
    return None
num = lambda s: float(str(s).replace(",", "").replace("+", "")) if s not in (None, "") else None
old = pd.read_csv(P, dtype={"code": str, "date": str}) if os.path.exists(P) else pd.DataFrame(columns=["code", "date", "frgn", "inst", "indiv"])
lastd = old.groupby("code")["date"].max().to_dict() if len(old) else {}
codes = [r[0] for r in json.load(open("data/KR/index.json", encoding="utf-8"))["rows"]]
tom = (datetime.datetime.utcnow() + datetime.timedelta(hours=33)).strftime("%Y%m%d")
def one(c):
    stop = lastd.get(c, "20151101"); out, bd = [], tom
    for _ in range(4000 // PS):
        j = get(f"https://m.stock.naver.com/api/stock/{c}/trend?pageSize={PS}&bizdate={bd}")
        if not j: break
        for x in j: out.append([c, str(x.get("bizdate")), num(x.get("foreignerPureBuyQuant")), num(x.get("organPureBuyQuant")), num(x.get("individualPureBuyQuant"))])
        last = str(j[-1].get("bizdate") or "")
        if not last or last <= stop or len(j) < PS: break
        bd = last; time.sleep(0.05)
    return out
new = []
with cf.ThreadPoolExecutor(8) as ex:
    for rs in ex.map(one, codes): new += rs
nd = pd.DataFrame(new, columns=["code", "date", "frgn", "inst", "indiv"])
allf = pd.concat([old, nd]).drop_duplicates(["code", "date"], keep="last").sort_values(["code", "date"])
os.makedirs("flowcache", exist_ok=True); allf.to_csv(P, index=False, compression="gzip")
print("수급 캐시", len(old), "→", len(allf), "새로 받은 행", len(nd), "마지막", allf["date"].max())
if len(allf) < 1_000_000: raise SystemExit("수급 캐시가 너무 작음")
