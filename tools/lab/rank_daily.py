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
fl = pd.read_csv("flowcache/kr_flow_10y.csv.gz", dtype={"code": str, "date": str}); fl["date"] = pd.to_datetime(fl["date"], format="%Y%m%d", errors="coerce")
df = df.merge(fl.dropna(subset=["date"]).drop_duplicates(["code", "date"]), on=["code", "date"], how="left")
print("수급 연결률", round(df["frgn"].notna().mean() * 100, 1), "%", flush=True)
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
vs5 = g["volume"].transform(lambda s: s.rolling(5).sum()).astype(float) + 1; vs20 = g["volume"].transform(lambda s: s.rolling(20).sum()).astype(float) + 1
for col, nm in [("frgn", "f"), ("inst", "i")]:
    x = df[col].fillna(0)
    F[nm + "n5"] = x.groupby(gc).transform(lambda s: s.rolling(5).sum()) / vs5
    F[nm + "n20"] = x.groupby(gc).transform(lambda s: s.rolling(20).sum()) / vs20
    F[nm + "d5"] = (x > 0).astype(float).groupby(gc).transform(lambda s: s.rolling(5).sum())
F["fin5"] = F["fn5"] + F["in5"]
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
out = {"date": str(last.date()), "made": (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime("%Y-%m-%d %H:%M"), "model": "lgb-10y-flow-v2", "n": int(len(d)),
       "note": "AI 상대 순위(시험, 외국인·기관 수급 포함): 다음 5거래일 동안 시장 평균보다 나을 가능성의 순위. 2019~2026 처음 보는 해 검증에서 상위 10%가 시장보다 매년 나았지만, 비용 뺀 절대수익은 해마다 달랐음. 매수 추천이 아님.",
       "val": {"period": "2019~2026 각 해를 처음 보는 해로 두고 그 전 해들로만 학습(8번)", "rule": "5거래일마다 상위 10종목, 다음날 시가→5거래일 뒤 종가, 비용 0.25%, 거래대금 5억 이상", "years": [[2019, 1.15, 0.73], [2020, 0.82, 1.19], [2021, 0.36, 0.38], [2022, 0.97, 0.38], [2023, 1.42, 1.59], [2024, 0.74, 0.32], [2025, 1.38, 1.80], [2026, 1.02, 0.90]], "prev": [[2019, 1.53], [2020, 0.93], [2021, 0.31], [2022, 0.17], [2023, 1.43], [2024, 1.24], [2025, 1.25], [2026, 0.19]], "limits": "상장폐지 종목 빠짐(생존 편향, 다음 주 재검증) · 백테스트이며 실거래 아님 · 2019·2024년은 수급을 넣기 전보다 낮음"},
       "rows": [[r.code, names.get(r.code, ""), round(float(r.pct) * 100, 1), round(float(r.p) * 100, 2), bool(r.liq)] for r in d.itertuples()]}
os.makedirs("static", exist_ok=True)
json.dump(out, open("static/rank_kr.json", "w", encoding="utf-8"), ensure_ascii=False)
print("완료", out["date"], out["n"], out["rows"][:5])

# 실제 성적표: 매일 낸 순위를 보관(Actions 캐시)하고, 5거래일이 지난 날은 실제 가격으로 채점
HP = "flowcache/rank_hist.csv.gz"
today_h = pd.DataFrame({"date": str(last.date()), "code": d["code"].values, "pct": d["pct"].values, "liq": d["liq"].values})
hist = pd.concat([pd.read_csv(HP, dtype={"code": str, "date": str}) if os.path.exists(HP) else today_h.iloc[:0], today_h]).drop_duplicates(["date", "code"], keep="last")
hist.to_csv(HP, index=False, compression="gzip")
yy = pd.DataFrame({"date": df["date"].dt.strftime("%Y-%m-%d"), "code": df["code"], "y": y.values, "liq0": liq.values})
tr_rows = []
for D, hd in hist.groupby("date"):
    m_ = hd.merge(yy, on=["date", "code"], how="left")
    m_ = m_[(m_["liq"].astype(str) == "True") & m_["y"].notna()]
    if len(m_) < 50: continue
    top = m_.sort_values("pct", ascending=False).head(10)["y"].mean(); al = m_["y"].mean()
    tr_rows.append([D, round(top * 100, 2), round(al * 100, 2), round((top - al) * 100, 2)])
json.dump({"made": out["made"], "rule": "다음날 시가 매수 → 5거래일 뒤 종가, 비용 0.25%, 거래대금 5억 이상 상위 10종목", "rows": sorted(tr_rows)}, open("static/rank_track.json", "w", encoding="utf-8"), ensure_ascii=False)
print("성적표", len(hist["date"].unique()), "일 보관,", len(tr_rows), "일 채점")
