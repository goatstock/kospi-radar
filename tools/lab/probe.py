# 자료원 시험 2: 야간선물 단서 찾기('야간'·night 주변 글자 출력)
import urllib.request, re
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", "Referer": "https://m.stock.naver.com/"}
U = ["https://m.stock.naver.com/api/index/FUT/integration", "https://finance.naver.com/sise/sise_index.naver?code=FUT",
     "https://m.stock.naver.com/domestic/index/FUT/total", "https://finance.naver.com/sise/", "https://m.stock.naver.com/api/home/majors",
     "https://m.stock.naver.com/api/index/majors", "https://m.stock.naver.com/front-api/home/domestic/index?category=futures",
     "https://www.krx.co.kr/main/main.jsp", "https://open.krx.co.kr/contents/MKD/99/MKD99000001.jsp"]
for u in U:
    try:
        raw = urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=15).read()
        try: t = raw.decode("utf-8")
        except UnicodeDecodeError: t = raw.decode("euc-kr", "ignore")
        hits = [m.start() for m in re.finditer(r"야간|[Nn]ight|NIGHT|NFUT|ngt", t)][:6]
        print("OK ", u, len(t), "hits", len(hits))
        for h in hits: print("    ...", t[max(0, h - 150):h + 250].replace("\n", " "))
    except Exception as e: print("ERR", u, e)
