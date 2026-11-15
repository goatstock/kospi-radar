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

st, b = get(WEB + "health", slow=4.0)
try:
    H = json.loads(b)
except Exception as e:
    H = {}; bad.append(f"/health 해석 실패 {e}")
for k in ("i", "q", "night"):
    x = H.get(k) or {}
    if "err" in x or "v" not in x: bad.append(f"중계 서버 {k} 오류 {x.get('err','')}")
    elif x.get("ms", 0) > 3000: warn.append(f"중계 서버 {k} 느림 {x['ms']}ms")
k = ((H.get("i") or {}).get("v") or {}).get("KOSPI") or []
if not k or not k[0]: bad.append("코스피 지수 시세 없음")
elif now.weekday() < 5:
    s2 = str(k[2])
    if 1005 <= hm <= 1525 and s2 != "OPEN": bad.append(f"장중인데 코스피 상태 {s2}")
    elif 905 <= hm < 1005 and s2 != "OPEN": warn.append(f"09시대 코스피 상태 {s2}(수능 등 늦은 개장일 수 있음)")
Q = (H.get("q") or {}).get("v") or {}
for c in ("005930", "000660"):
    if not (Q.get(c) or [None])[0]: bad.append(f"종목 시세 없음 {c}")
if not ((H.get("night") or {}).get("v") or [None])[0]: bad.append("코스피200 선물 시세 없음")
F = H.get("files") or {}
ix = F.get("data/KR/index.json")
if ix:
    age = (time.time() * 1000 - ix) / 60000
    print(f"PC 레이더 자료(index.json) {age:.0f}분 전 갱신")
    if now.weekday() < 5 and 1000 <= hm <= 1530 and age > 90: warn.append(f"PC 레이더 자료가 {age:.0f}분째 갱신 안 됨(회장님 PC 프로그램 확인)")

print(f"{now:%Y-%m-%d %H:%M} KST 점검")
for w in warn: print("주의:", w)
for x in bad: print("문제:", x)
if bad: sys.exit(1)
print("정상")
