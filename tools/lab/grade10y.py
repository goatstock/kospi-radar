# 11-17 회장님 지시 "등급은 10년치 분석에": 10년 일봉(현재 상장 1,243종목)으로 추세 등급 정의별 미래 초과수익 검증.
# 결과는 로그로만 출력(자료는 저장소에 올리지 않음). 생존 편향 주의: 상장폐지 종목 없음.
import csv, gzip, json, statistics as st, collections as C
B = C.defaultdict(list)
with gzip.open("kr_daily_10y.csv.gz", "rt", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        try: B[r["code"]].append((r["date"], float(r["open"]), float(r["high"]), float(r["low"]), float(r["close"])))
        except: pass
print("종목", len(B), "행", sum(map(len, B.values())))
COST = 0.0025
S = []  # (date, label, f5, f20)
def ma(a, i, n): return sum(a[i-n+1:i+1]) / n
for c, b in B.items():
    b.sort(); cl = [x[4] for x in b]; n = len(b)
    if n < 300: continue
    s20 = [0]*n; s60 = [0]*n; acc = 0
    for i in range(130, n-21, 1):
        if cl[i] <= 0 or b[i+1][1] <= 0: continue
        m20, m60, m120 = ma(cl, i, 20), ma(cl, i, 60), ma(cl, i, 120)
        r20 = cl[i]/cl[i-20]-1; r5 = cl[i]/cl[i-5]-1; hi = max(x[2] for x in b[max(0,i-250):i+1])
        o = b[i+1][1]; f5 = b[i+5][4]/o-1; f20 = b[i+20][4]/o-1
        if abs(f5) > 1 or abs(f20) > 2: continue
        S.append((b[i][0], r20, r5, cl[i] > m20 > m60, cl[i] < m20 < m60, cl[i]/hi, cl[i] > m120, f5, f20))
print("표본", len(S))
D = C.defaultdict(list)
for x in S: D[x[0]].append(x)
def test(name, key):
    T5=[];B5=[];T20=[];B20=[];Y=C.defaultdict(list);ABS=[]
    for d, L in D.items():
        if len(L) < 300: continue
        a5 = st.mean(x[7] for x in L); a20 = st.mean(x[8] for x in L)
        s = sorted(L, key=key); k = len(s)//5; lo, hi = s[:k], s[-k:]
        t5 = st.mean(x[7] for x in hi); b5 = st.mean(x[7] for x in lo)
        T5.append(t5-a5); B5.append(b5-a5); T20.append(st.mean(x[8] for x in hi)-a20); B20.append(st.mean(x[8] for x in lo)-a20)
        Y[d[:4]].append(t5-b5); ABS.append(t5-COST)
    yr = " ".join(f"{y}:{st.mean(v)*100:+.2f}" for y, v in sorted(Y.items()))
    print(f"■ {name}\n  상위20% 5일 {st.mean(T5)*100:+.2f}%p · 하위20% {st.mean(B5)*100:+.2f}%p · 20일 상위 {st.mean(T20)*100:+.2f} 하위 {st.mean(B20)*100:+.2f}%p · 상위 5일 절대(비용뒤) {st.mean(ABS)*100:+.2f}%\n  연도별(상위-하위 5일): {yr} · 플러스 연도 {sum(st.mean(v)>0 for v in Y.values())}/{len(Y)}")
test("20일 수익률(모멘텀)", lambda x: x[1])
test("5일 수익률", lambda x: x[2])
test("정배열(추세 강세)", lambda x: (x[3], -x[4], x[1]))
test("52주 고점 근접", lambda x: x[5])
test("120일선 위", lambda x: (x[6], x[1]))
# 현재 등급과 같은 묘사 기준: 정배열 & 20일+ = 강세, 역배열 & 20일- = 약세
G = C.defaultdict(lambda: [[], []])
for d, L in D.items():
    if len(L) < 300: continue
    a5 = st.mean(x[7] for x in L); a20 = st.mean(x[8] for x in L)
    for x in L:
        g = "강세" if x[3] and x[1] > 0 else "약세" if x[4] and x[1] < 0 else "중간"
        G[g][0].append(x[7]-a5); G[g][1].append(x[8]-a20)
for g, (v5, v20) in G.items(): print(f"  [{g}] n={len(v5)} 5일 초과 {st.mean(v5)*100:+.2f}%p · 20일 초과 {st.mean(v20)*100:+.2f}%p · 5일 시장보다 나음 {sum(v>0 for v in v5)/len(v5)*100:.1f}%")
