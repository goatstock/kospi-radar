# 미국 S&P500 'AI 상대 순위(시험)' 매일 계산 (2026-11-14 회장님 지시) — 20년 일봉 학습, 순위 구간만 내보냄(예상 수익률 숫자 없음)
import os, json, time, datetime, urllib.request, concurrent.futures as cf
import numpy as np, pandas as pd, lightgbm as lgb
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"}
rows0 = json.load(open("data/US/index.json", encoding="utf-8"))["rows"]; names = {r[0]: r[1] for r in rows0}
def get(u):
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=25) as r: return json.loads(r.read().decode())
        except Exception: time.sleep(2 * (k + 1))
    return None
def yh(t):
    j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{t.replace('.', '-')}?period1=1104537600&period2=1900000000&interval=1d&events=div%2Csplit"); time.sleep(0.15)
    try:
        r = j["chart"]["result"][0]; q = r["indicators"]["quote"][0]; adj = r["indicators"].get("adjclose", [{}])[0].get("adjclose")
        return [[t, ts, q["open"][i], q["high"][i], q["low"][i], q["close"][i], q["volume"][i], adj[i] if adj else None] for i, ts in enumerate(r["timestamp"])]
    except Exception: return []
A = []
with cf.ThreadPoolExecutor(6) as ex:
    for rs in ex.map(yh, list(names) + ["^GSPC"]): A += rs
df = pd.DataFrame(A, columns=["code", "ts", "open", "high", "low", "close", "volume", "adjclose"])
for c_ in ["open", "high", "low", "close", "volume", "adjclose"]: df[c_] = pd.to_numeric(df[c_], errors="coerce")
df["date"] = pd.to_datetime(df["ts"] - 4 * 3600, unit="s").dt.normalize()
r_ = (df["adjclose"] / df["close"]).fillna(1.0)
for c_ in ["open", "high", "low", "close"]: df[c_] = df[c_] * r_
df["frgn_rate"] = np.nan
idxdf = df[df["code"] == "^GSPC"].copy(); df = df[~df["code"].str.startswith("^")]
df = df.dropna(subset=["date", "close", "open"]).query("close>0 and open>0").drop_duplicates(["code", "date"]).sort_values(["code", "date"]).reset_index(drop=True)
k = idxdf.drop_duplicates("date").sort_values("date").set_index("date")["close"].astype(float)
kf = pd.DataFrame({"k_r20": k.pct_change(20), "k_r60": k.pct_change(60), "k_ma60": k / k.rolling(60).mean() - 1, "k_r5": k.pct_change(5)})
COST = 0.001
print("행", len(df), "종목", df.code.nunique(), "기간", df.date.min().date(), "~", df.date.max().date())

g = df.groupby("code", group_keys=False)
c, o, h, l, v = df["close"], df["open"], df["high"], df["low"], df["volume"].astype(float)
F = pd.DataFrame(index=df.index)
for n in [1, 5, 20, 60, 120, 250]: F[f"r{n}"] = g["close"].pct_change(n)
for n in [5, 20, 60, 120]: F[f"ma{n}"] = c / g["close"].transform(lambda s: s.rolling(n).mean()) - 1
ret = g["close"].pct_change()
F["vol20"] = ret.groupby(df["code"]).transform(lambda s: s.rolling(20).std())
F["vratio"] = v / g["volume"].transform(lambda s: s.rolling(20).mean())
F["turn"] = np.log1p(c * v)
up = ret.clip(lower=0); dn = (-ret).clip(lower=0)
F["rsi"] = up.groupby(df["code"]).transform(lambda s: s.rolling(14).mean()) / (up.groupby(df["code"]).transform(lambda s: s.rolling(14).mean()) + dn.groupby(df["code"]).transform(lambda s: s.rolling(14).mean()) + 1e-9)
F["bbz"] = (c - g["close"].transform(lambda s: s.rolling(20).mean())) / (g["close"].transform(lambda s: s.rolling(20).std()) + 1e-9)
F["hi52"] = c / g["high"].transform(lambda s: s.rolling(250).max()) - 1
F["lo52"] = c / g["low"].transform(lambda s: s.rolling(250).min()) - 1
F["gap"] = o / g["close"].shift(1) - 1
F["rng"] = (h - l) / c
F["body"] = (c - o) / o
fr = pd.to_numeric(df["frgn_rate"], errors="coerce")
F = F.join(df[["date"]]).merge(kf, left_on="date", right_index=True, how="left").drop(columns="date")
F.index = df.index
F["rs20"] = F["r20"] - F["k_r20"]; F["rs60"] = F["r60"] - F["k_r60"]
# 목표: 다음날 시가 → 5거래일 뒤 종가, 비용 차감
o1 = g["open"].shift(-1); c5 = g["close"].shift(-5)
df["y"] = c5 / o1 - 1 - COST
big = (ret.abs() > 0.35).astype(float)  # 액면병합·분할 등 가격 단절 → 그 앞뒤 구간은 학습·검증에서 제외
fw = big.groupby(df["code"]).transform(lambda s: s[::-1].rolling(7, min_periods=1).max()[::-1])
df.loc[fw > 0, "y"] = np.nan
df["yx"] = df["y"] - df.groupby("date")["y"].transform("mean")  # 그날 전 종목 평균 대비
X = F.replace([np.inf, -np.inf], np.nan)
liq = (df["close"] * df["volume"] > 2e7)
last = df["date"].max(); tr = df["y"].notna() & X["r60"].notna() & liq; te = (df["date"] == last) & X["r60"].notna()
m = lgb.LGBMRegressor(n_estimators=300, learning_rate=0.03, num_leaves=31, min_child_samples=500, subsample=0.7, subsample_freq=1, colsample_bytree=0.7, verbose=-1)
m.fit(X[tr], df.loc[tr, "yx"])
d = df[te].copy(); d["p"] = m.predict(X[te]); d["liq"] = liq[te].values; d["pct"] = d["p"].rank(pct=True); d = d.sort_values("p", ascending=False)
VAL = json.load(open("tools/lab/us_val.json", encoding="utf-8")) if os.path.exists("tools/lab/us_val.json") else None
out = {"date": str(last.date()), "made": (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime("%Y-%m-%d %H:%M"), "model": "lgb-us-20y-v1", "n": int(len(d)), "m": "US",
       "note": "미국 AI 상대 순위(시험): 다음 5거래일 동안 S&P500 평균보다 나을 가능성의 순위 구간. 매수 추천이 아님.", "val": VAL,
       "rows": [[r.code, names.get(r.code, ""), round(float(r.pct) * 100, 1), None, bool(r.liq)] for r in d.itertuples()]}
os.makedirs("static", exist_ok=True); json.dump(out, open("static/rank_us.json", "w", encoding="utf-8"), ensure_ascii=False)
print("완료", out["date"], out["n"], [r[:3] for r in out["rows"][:5]])
