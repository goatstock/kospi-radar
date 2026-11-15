# 장중 실시간 감시(11-16 회장님 지시: 장 시작하면 절대 늦지 않도록 실시간 감시가 기본 임무)
# 평일 08:00~16:00(KST) 5분마다 GitHub Actions에서 실행. 문제가 있으면 실패로 끝나 회장님 메일로 알림이 간다.
import json, time, urllib.request, datetime, sys
LIVE = "https://goatstock-live.ppopposs22.workers.dev"
WEB = "https://goatstock-web.ppopposs22.workers.dev/"
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
hm = now.hour * 100 + now.minute
bad, warn = [], []

def get(url, slow=3.0):
    t = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "goatstock-watch"}), timeout=15)
        body = r.read(); dt = time.time() - t
        if dt > slow: warn.append(f"느림 {dt:.1f}초: {url}")
        return r.status, body
    except Exception as e:
        bad.append(f"접속 실패: {url} ({e})"); return None, b""

st, _ = get(WEB)
if st and st != 200: bad.append(f"사이트 응답 {st}")
st, b = get(LIVE + "/i")
try:
    I = json.loads(b); k = I.get("KOSPI") or []
    if not k or not k[0]: bad.append("코스피 지수 시세 없음")
    elif now.weekday() < 5:
        s = str(k[2])
        if 1005 <= hm <= 1525 and s != "OPEN": bad.append(f"장중인데 코스피 상태 {s}")
        elif 905 <= hm < 1005 and s != "OPEN": warn.append(f"09시대 코스피 상태 {s}(수능 등 늦은 개장일 수 있음)")
except Exception as e:
    if st: bad.append(f"/i 해석 실패 {e}")
st, b = get(LIVE + "/q?c=005930,000660")
try:
    Q = json.loads(b)
    for c in ("005930", "000660"):
        if not (Q.get(c) or [None])[0]: bad.append(f"종목 시세 없음 {c}")
except Exception as e:
    if st: bad.append(f"/q 해석 실패 {e}")
st, b = get(LIVE + "/night")
try:
    N = json.loads(b)
    if not (N.get("fut") or [None])[0]: bad.append("코스피200 선물 시세 없음")
except Exception as e:
    if st: bad.append(f"/night 해석 실패 {e}")

print(f"{now:%Y-%m-%d %H:%M} KST 점검")
for w in warn: print("주의:", w)
for x in bad: print("문제:", x)
if bad: sys.exit(1)
print("정상")
