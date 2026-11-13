# 매일 장마감 뒤(v1.1): 10년 일봉으로 학습 → 오늘 전 종목 'AI 상대 순위(시험)' 계산 → static/rank_kr.json
# 목표값: 다음날 시가 매수 → 5거래일 뒤 종가, 비용 차감, 그날 전체 평균 대비 초과수익. 매수 추천이 아님.
import os, sys, json, gzip, csv, time, urllib.request, concurrent.futures as cf, datetime
import numpy as np, pandas as pd, lightgbm as lgb
H = {"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"}
today = (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime("%Y%m%d")
S, E = "201511010000", today + "2359"
def get(u):
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=20) as r: return json.loads(r.read().decode())
        except Exception: time.sleep(1.5 * (k + 1))
    return None
rows = json.load(open("data/KR/index.json", encoding="utf-8"))["rows"]
names = {r[0]: r[1] for r in rows}
def one(c):
    j = get(f"https://api.stock.naver.com/chart/domestic/item/{c}/day?startDateTime={S}&endDateTime={E}") or []
    time.sleep(0.12)
    return [[c, x.get("localDate"), x.get("openPrice"), x.get("highPrice"), x.get("lowPrice"), x.get("closePrice"), x.get("accumulatedTradingVolume"), x.get("foreignRetentionRate")] for x in j]
L = []
with cf.ThreadPoolExecutor(6) as ex:
    for rs in ex.map(one, list(names)): L += rs
df = pd.DataFrame(L, columns=["code", "date", "open", "high", "low", "close", "volume", "frgn_rate"])
for c in ["open", "high", "low", "close", "volume", "frgn_rate"]: df[c] = pd.to_numeric(df[c], errors="coerce")
df["date"] = pd.to_datetime(df["date"].astype(str), format="%Y%m%d", errors="coerce")
df = df.dropna(subset=["date", "close", "open"]).query("close>0 and open>0").sort_values(["code", "date"]).reset_index(drop=True)
kj = get(f"https://api.stock.naver.com/chart/domestic/index/KOSPI/day?startDateTime={S}&endDateTime={E}") or []
k = pd.Series([float(x["closePrice"]) for x in kj], index=pd.to_datetime([str(x["localDate"]) for x in kj], format="%Y%m%d")).sort_index()
kf = pd.DataFrame({"k_r20": k.pct_change(20), "k_r60": k.pct_change(60), "k_ma60": k / k.rolling(60).mean() - 1, "k_r5": k.pct_change(5)})
print("행", len(df), "종목", df.code.nunique(), "마지막", df.date.max().date(), flush=True)
g = df.groupby("code", group_keys=False); c, o, h, l, v = df["close"], df["open"], df["high"], df["low"], df["volume"].astype(float)
F = pd.DataFrame(index=df.index)
for n in [1, 5, 20, 60, 120, 250]: F[f"r{n}"] = g["close"].pct_change(n)
for n in [5, 20, 60, 120]: F[f"ma{n}"] = c / g["close"].transform(lambda s: s.rolling(n).mean()) - 1
ret = g["close"].pct_change(); gc = df["code"]
F["vol20"] = ret.groupby(gc).transform(lambda s: s.rolling(20).std())
F["vratio"] = v / g["volume"].transform(lambda s: s.rolling(20).mean())
F["turn"] = np.log1p(c * v)
up = ret.clip(lower=0); dn = (-ret).clip(lower=0)
mu = up.groupby(gc).transform(lambda s: s.rolling(14).mean()); md = dn.groupby(gc).transform(lambda s: s.rolling(14).mean())
F["rsi"] = mu / (mu + md + 1e-9)
F["bbz"] = (c - g["close"].transform(lambda s: s.rolling(20).mean())) / (g["close"].transform(lambda s: s.rolling(20).std()) + 1e-9)
F["hi52"] = c / g["high"].transform(lambda s: s.rolling(250).max()) - 1
F["lo52"] = c / g["low"].transform(lambda s: s.rolling(250).min()) - 1
F["gap"] = o / g["close"].shift(1) - 1; F["rng"] = (h - l) / c; F["body"] = (c - o) / o
fr = df["frgn_rate"]; F["fr5"] = fr - fr.groupby(gc).shift(5); F["fr20"] = fr - fr.groupby(gc).shift(20)
F = F.join(df[["date"]]).merge(kf, left_on="date", right_index=True, how="left").drop(columns="date"); F.index = df.index
F["rs20"] = F["r20"] - F["k_r20"]; F["rs60"] = F["r60"] - F["k_r60"]
X = F.replace([np.inf, -np.inf], np.nan)
y = g["close"].shift(-5) / g["open"].shift(-1) - 1 - 0.0025
df["yx"] = y - y.groupby(df["date"]).transform("mean")
liq = (df["close"] * df["volume"] > 5e8)
tr = df["yx"].notna() & X["r60"].notna() & liq
last = df["date"].max(); te = (df["date"] == last) & X["r60"].notna()
m = lgb.LGBMRegressor(n_estimators=300, learning_rate=0.03, num_leaves=31, min_child_samples=500, subsample=0.7, subsample_freq=1, colsample_bytree=0.7, verbose=-1)
m.fit(X[tr], df.loc[tr, "yx"])
d = df[te].copy(); d["p"] = m.predict(X[te]); d["liq"] = liq[te]
d["pct"] = d["p"].rank(pct=True)
d = d.sort_values("p", ascending=False)
out = {"date": str(last.date()), "made": (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime("%Y-%m-%d %H:%M"), "model": "lgb-10y-v1", "n": int(len(d)),
       "note": "AI 상대 순위(시험): 다음 5거래일 동안 시장 평균보다 나을 가능성의 순위. 2019~2026 처음 보는 해 검증에서 상위 10%가 시장보다 매년 나았지만, 비용 뺀 절대수익은 해마다 달랐음. 매수 추천이 아님.",
       "rows": [[r.code, names.get(r.code, ""), round(float(r.pct) * 100, 1), round(float(r.p) * 100, 2), bool(r.liq)] for r in d.itertuples()]}
os.makedirs("static", exist_ok=True)
json.dump(out, open("static/rank_kr.json", "w", encoding="utf-8"), ensure_ascii=False)
print("완료", out["date"], out["n"], out["rows"][:5])
