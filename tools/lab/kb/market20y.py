# 20년 시장 현황 습득(국내·미국): 지수 국면·낙폭·회복, 계절성, 큰 하락 뒤 흐름, 요인(모멘텀·되돌림·저변동·52주고가·외국인) 연도별 성과
import sys, gzip, json, numpy as np, pandas as pd
M = sys.argv[1]; D = "/home/claude/lab/long"
if M == "kr":
    df = pd.read_csv(f"{D}/kr_daily_20y.csv.gz", dtype={"code": str}, usecols=["code","date","close","volume","frgn_rate"])
    df["date"] = pd.to_datetime(df["date"].astype(str), format="%Y%m%d", errors="coerce")
    idx = json.load(gzip.open(f"{D}/kr_index_20y.json.gz", "rt"))
    I = {k: pd.DataFrame(v, columns=["date","o","h","l","c","v"]).assign(date=lambda x: pd.to_datetime(x.date.astype(str), format="%Y%m%d")).set_index("date")["c"].astype(float).sort_index() for k, v in idx.items()}
    MAIN = "KOSPI"; LIQ = 5e8
else:
    df = pd.read_csv(f"{D}/us_daily_20y.csv.gz", dtype={"code": str}, usecols=["code","ts","close","volume","adjclose"])
    df["date"] = pd.to_datetime(df["ts"] - 4*3600, unit="s").dt.normalize(); df["close"] = df["adjclose"].fillna(df["close"]); df["frgn_rate"] = np.nan
    ix = df[df.code.str.startswith("^")]; I = {c: g.drop_duplicates("date").set_index("date")["close"].astype(float).sort_index() for c, g in ix.groupby("code")}
    df = df[~df.code.str.startswith("^")]; MAIN = "^GSPC"; LIQ = 2e7
df = df.dropna(subset=["date","close"]).query("close>0").drop_duplicates(["code","date"]).sort_values(["code","date"]).reset_index(drop=True)
for c in ["close","volume","frgn_rate"]: df[c] = df[c].astype("float32")
K = I[MAIN]; out = {"market": M, "period": [str(K.index[0].date()), str(K.index[-1].date())], "stocks": int(df.code.nunique())}
# 1) 연도별 지수
yr = K.groupby(K.index.year).agg(["first","last","max","min"]); r = K.pct_change()
Y = {}
for y in yr.index:
    s = K[K.index.year == y]; dd = (s / s.cummax() - 1).min()
    Y[int(y)] = {"ret%": round((s.iloc[-1] / K[K.index < s.index[0]].iloc[-1] - 1) * 100 if (K.index < s.index[0]).any() else (s.iloc[-1]/s.iloc[0]-1)*100, 1), "mdd%": round(dd*100,1), "vol%": round(r[s.index].std()*np.sqrt(252)*100,1)}
out["years"] = Y
# 2) 큰 하락 구간(고점 대비 -20% 이상)과 회복 기간
dd = K / K.cummax() - 1; eps = []; inb = False
for d, v in dd.items():
    if not inb and v <= -0.2: inb = True; pk = K[:d].idxmax(); 
    if inb and v == 0: tr = K[pk:d].idxmin(); eps.append({"peak": str(pk.date()), "trough": str(tr.date()), "drop%": round((K[tr]/K[pk]-1)*100,1), "days_to_trough": int((tr-pk).days), "days_to_recover": int((d-tr).days), "recovered": str(d.date())}); inb = False
if inb: tr = K[pk:].idxmin(); eps.append({"peak": str(pk.date()), "trough": str(tr.date()), "drop%": round((K[tr]/K[pk]-1)*100,1), "days_to_trough": int((tr-pk).days), "recovered": None, "now_from_peak%": round(dd.iloc[-1]*100,1)})
out["bear_markets"] = eps
# 3) 계절성(월별)·요일
mr = K.resample("ME").last().pct_change().dropna()
out["month"] = {int(m): {"avg%": round(g.mean()*100,2), "up%": round((g>0).mean()*100)} for m, g in mr.groupby(mr.index.month)}
out["weekday"] = {["월","화","수","목","금"][d]: {"avg%": round(g.mean()*100,3), "up%": round((g>0).mean()*100)} for d, g in r.dropna().groupby(r.dropna().index.dayofweek) if d < 5}
# 4) 큰 하락일 뒤 흐름
f5, f20 = K.shift(-5)/K-1, K.shift(-20)/K-1
for th in [-0.03, -0.05]:
    m = r <= th
    out[f"after_drop_{int(-th*100)}pct"] = {"n": int(m.sum()), "next5_avg%": round(f5[m].mean()*100,2), "next5_up%": round((f5[m]>0).mean()*100), "next20_avg%": round(f20[m].mean()*100,2), "next20_up%": round((f20[m]>0).mean()*100)}
out["base_next20_up%"] = round((f20>0).mean()*100)
# 5) 요인 성과(월말 리밸런스, 다음 20거래일, 상위20%-하위20% 수익 차, 유동성 필터)
g = df.groupby("code")["close"]; df["ret"] = g.pct_change()
big = (df["ret"].abs() > 0.35).astype("float32"); df["brk"] = big.groupby(df.code).transform(lambda s: s[::-1].rolling(22, min_periods=1).max()[::-1])
df["fwd"] = g.shift(-20) / df.close - 1
df["mom"] = g.shift(21) / g.shift(252) - 1
df["rev"] = -(df.close / g.shift(5) - 1)
df["lowvol"] = -df["ret"].groupby(df.code).transform(lambda s: s.rolling(60).std())
df["hi52"] = df.close / g.transform(lambda s: s.rolling(250).max())
df["frg"] = df["frgn_rate"] - df.groupby("code")["frgn_rate"].shift(20)
df["liq"] = (df.close * df.volume).groupby(df.code).transform(lambda s: s.rolling(20).mean())
me = df[df.date.isin(df.groupby(df.date.dt.to_period("M"))["date"].max().unique())]
me = me[(me.liq > LIQ) & (me.brk == 0) & me.fwd.notna()]
F = {}
for f in ["mom","rev","lowvol","hi52"] + (["frg"] if M == "kr" else []):
    rows = []
    for d, x in me.dropna(subset=[f]).groupby("date"):
        if len(x) < 50: continue
        q = x[f].rank(pct=True); rows.append((d.year, x.fwd[q>0.8].mean() - x.fwd[q<=0.2].mean()))
    t = pd.DataFrame(rows, columns=["y","s"]); yy = t.groupby("y").s.mean()*100
    F[f] = {"avg_spread%_per_20d": round(t.s.mean()*100,2), "win_months%": round((t.s>0).mean()*100), "by_year": {int(a): round(b,2) for a, b in yy.items()}}
out["factors"] = F
# 6) 지금 위치
out["now"] = {"index": round(float(K.iloc[-1]),2), "from_ath%": round(float(dd.iloc[-1]*100),1), "ret_1y%": round(float((K.iloc[-1]/K.iloc[-252]-1)*100),1), "vs_ma200%": round(float((K.iloc[-1]/K.rolling(200).mean().iloc[-1]-1)*100),1)}
json.dump(out, open(f"/home/claude/lab/kb/{M}_20y.json","w"), ensure_ascii=False, indent=1, default=float)
print(json.dumps({k: v for k, v in out.items() if k not in ("years",)}, ensure_ascii=False, default=float)[:3800])
