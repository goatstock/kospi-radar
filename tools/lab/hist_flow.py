# 10년 외국인·기관·개인 일별 순매수(주) 수집(연구용). 산출물 1일 보관, 저장소에 안 올림.
import json, gzip, csv, time, sys, urllib.request, concurrent.futures as cf
H = {"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"}
def get(u):
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=20) as r: return json.loads(r.read().decode())
        except Exception: time.sleep(1.5 * (k + 1))
    return None
num = lambda s: float(str(s).replace(",", "").replace("+", "")) if s not in (None, "") else None
# 한 번에 받는 최대 개수 확인
for ps in (100, 60, 30, 20, 10):
    t = get(f"https://m.stock.naver.com/api/stock/005930/trend?pageSize={ps}&bizdate=20260101")
    if t and len(t) >= ps * 0.9: PS = ps; break
else: PS = 10
print("pageSize", PS, flush=True)
codes = [r[0] for r in json.load(open("data/KR/index.json", encoding="utf-8"))["rows"]]
def one(c):
    out, bd = [], "20261114"
    for _ in range(4000 // PS):
        j = get(f"https://m.stock.naver.com/api/stock/{c}/trend?pageSize={PS}&bizdate={bd}")
        if not j: break
        for x in j: out.append([c, x.get("bizdate"), num(x.get("foreignerPureBuyQuant")), num(x.get("organPureBuyQuant")), num(x.get("individualPureBuyQuant"))])
        last = j[-1].get("bizdate")
        if not last or last <= "20151101" or len(j) < PS: break
        bd = last; time.sleep(0.08)
    return out
n = 0
with gzip.open("kr_flow_10y.csv.gz", "wt", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["code", "date", "frgn", "inst", "indiv"])
    with cf.ThreadPoolExecutor(8) as ex:
        for i, rs in enumerate(ex.map(one, codes)):
            w.writerows(rs); n += len(rs)
            if i % 100 == 0: print(i, n, flush=True)
print("완료", n)
if n < 100000: sys.exit("too few")
