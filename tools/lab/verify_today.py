# 11-16 회장님 지시 "더 잘 검증해봐": 11-13 기준 등급·AI 순위가 오늘 실제로 어땠는지 전 종목 대조
import json, urllib.request, concurrent.futures as cf, statistics as st
H = {"User-Agent": "Mozilla/5.0"}
def get(c):
    try:
        j = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://m.stock.naver.com/api/stock/{c}/basic", headers=H), timeout=10).read())
        return c, float(str(j["fluctuationsRatio"]).replace(",", ""))
    except Exception: return c, None
def idx(c):
    j = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://m.stock.naver.com/api/index/{c}/basic", headers=H), timeout=10).read())
    return float(str(j["fluctuationsRatio"]).replace(",", "")), j.get("localTradedAt")
D = json.load(open("data/KR/index.json")); rows = D["rows"]
with cf.ThreadPoolExecutor(16) as ex: R = dict(ex.map(get, [r[0] for r in rows]))
ks, kt = idx("KOSPI"); kq, _ = idx("KOSDAQ")
print(f"기준 등급일 {D['asof']} → 오늘 등락(시각 {kt}) · 코스피 {ks:+.2f}% 코스닥 {kq:+.2f}% · 조회 {sum(v is not None for v in R.values())}/{len(rows)}")
def summ(name, codes):
    v = [R[c] for c in codes if R.get(c) is not None]
    if not v: print(name, "자료 없음"); return
    mk = {r[0]: (ks if r[9] == "KOSPI" else kq) for r in rows}
    ex = [R[c] - mk.get(c, ks) for c in codes if R.get(c) is not None]
    print(f"{name:12s} n={len(v):4d} 평균 {st.mean(v):+6.2f}% 중앙 {st.median(v):+6.2f}% 상승비율 {sum(x>0 for x in v)/len(v)*100:5.1f}% 시장대비 평균 {st.mean(ex):+6.2f}%p 시장보다나음 {sum(x>0 for x in ex)/len(ex)*100:5.1f}%")
for g in ["매수후보", "관심", "중립", "주의", "매도경고"]: summ(g, [r[0] for r in rows if r[3] == g])
summ("전체", [r[0] for r in rows])
AI = "388210 440110 079550 011070 009150 000155 095610 214370 000150 458870 009155 298000".split()
summ("AI상위12", AI)
# 점수와 오늘 등락의 순위상관(스피어만)
pairs = [(r[2], R[r[0]]) for r in rows if R.get(r[0]) is not None and r[2] is not None]
def rk(a): s = sorted(range(len(a)), key=lambda i: a[i]); o = [0]*len(a); [o.__setitem__(i, k) for k, i in enumerate(s)]; return o
a, b = rk([p[0] for p in pairs]), rk([p[1] for p in pairs]); n = len(pairs)
print(f"점수-오늘등락 순위상관 {1 - 6*sum((x-y)**2 for x, y in zip(a, b))/(n*(n*n-1)):+.3f} (n={n}, 0이면 무관, +면 점수 높을수록 덜 빠짐)")
top = sorted([(R[r[0]], r[1], r[2]) for r in rows if r[3] == "매수후보" and R.get(r[0]) is not None])
print("매수후보 중 오늘 가장 약한 5:", [(n, s, f"{v:+.1f}%") for v, n, s in top[:5]])
print("매수후보 중 오늘 가장 강한 5:", [(n, s, f"{v:+.1f}%") for v, n, s in top[-5:]])
B = json.load(open("data/backtest.json"))
print(f"\n[과거 검증 {B['start']}~{B['end']}, {B['days']}거래일] 등급별 5일 뒤 평균·승률 / 20일 뒤 평균")
for g in B["grades"]: print(f"  {g['action']:6s} n={g['n']:5d} 5일 {g['avg5']:+6.2f}% (오른 비율 {g['win5']:.0f}%) · 20일 {g['avg20']:+6.2f}% · 기간말 시장대비 {g['excess_end']:+.2f}%p")
