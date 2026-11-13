#!/bin/bash
# 배포 전 검사 한 번에: 기능 시험(1~100회) + 화면 배치 + 날짜·시각 100사례 회귀. 하나라도 실패하면 배포하지 말 것.
cd "$(dirname "$0")"; fail=0
for f in ftest.js ftest2.js ftest3.js ftest4.js ftest5.js ftest6.js ftest7.js ftest8.js ftest9.js ftest10.js; do
  r=$(timeout 180 node $f 2>&1); s=$(echo "$r" | grep '^합계'); echo "$f $s"; echo "$r" | grep '^실패' && fail=1; done
r=$(timeout 300 node layout.js 2>&1); echo "$r" | grep -v ': 정상'; echo "$r" | grep -q '^문제 0' || fail=1
N=${N:-100} W=6 timeout 1500 node audit.js > /tmp/qa_audit.log 2>&1; p=$(grep -c 통과 /tmp/qa_audit.log); x=$(grep -c 실패 /tmp/qa_audit.log); echo "회귀 ${p} 통과 / ${x} 실패"; [ "$x" = "0" ] || fail=1
[ $fail = 0 ] && echo "== 배포 가능" || echo "== 배포 금지: 실패 있음"; exit $fail
