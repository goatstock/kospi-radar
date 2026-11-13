import json,urllib.request,urllib.parse
H={"User-Agent":"Mozilla/5.0","Referer":"http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd"}
def post(bld,**kw):
    d=urllib.parse.urlencode({"bld":bld,**kw}).encode()
    try:
        r=urllib.request.urlopen(urllib.request.Request("http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd",data=d,headers=H),timeout=30).read().decode()
        print(bld,len(r),r[:400])
    except Exception as e: print(bld,"ERR",e)
post("dbms/MDC/STAT/standard/MDCSTAT01501",mktId="STK",trdDd="20200102",share="1",money="1")
post("dbms/MDC/STAT/standard/MDCSTAT02401",mktId="STK",strtDd="20200102",endDd="20200102",invstTpCd="9000",share="1",money="1")
post("dbms/MDC/STAT/issue/MDCSTAT23801",mktId="ALL",strtDd="20151101",endDd="20261113")
def get(u):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=30).read().decode(); print(u[:90],len(r),r[:300])
    except Exception as e: print(u[:90],"ERR",e)
get("https://m.stock.naver.com/api/stock/005930/trend?pageSize=10&bizdate=20200110")
get("https://api.stock.naver.com/chart/domestic/item/004170/day?startDateTime=201511010000&endDateTime=202611140000")
get("https://finance.naver.com/item/frgn.naver?code=005930&page=200")
