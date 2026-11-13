# login.src.html → login.html (배경 캔들·체크 아이콘·미니 차트·실제 화면 그림 끼워 넣기)
import random,sys
shot=sys.argv[1]
random.seed(7)
s=open('tools/deploy/login.src.html').read()
c=[];y=330
for i in range(34):
    x=820+i*18; y-=random.uniform(-6,10); h=random.uniform(14,40)
    c.append(f'<rect x="{x:.0f}" y="{y-h:.0f}" width="9" height="{h:.0f}" rx="2"/><rect x="{x+4:.0f}" y="{y-h-10:.0f}" width="1.5" height="{h+20:.0f}"/>')
s=s.replace('__CANDLES__',''.join(c))
s=s.replace('__CK__','<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>')
mc=['<svg viewBox="0 0 120 70" width="100%" height="70">'];yy=50
for i in range(14):
    x=4+i*8;o=yy;yy-=random.uniform(-3,5);cl=yy;t,b=min(o,cl),max(o,cl);col='#E53950' if cl<o else '#2670E8'
    mc.append(f'<line x1="{x+2.5}" y1="{t-4:.0f}" x2="{x+2.5}" y2="{b+4:.0f}" stroke="{col}"/><rect x="{x}" y="{t:.0f}" width="5" height="{max(2,b-t):.0f}" fill="{col}"/><rect x="{x}" y="{62-random.uniform(2,8):.0f}" width="5" height="8" fill="#A23CFF" opacity=".25"/>')
mc.append('<polyline class="drw" points="0,58 15,54 30,56 45,51 60,53 75,49 90,51 105,46 120,48" fill="none" stroke="#A23CFF" stroke-width="1.5"/></svg>')
s=s.replace('__MINICHART__',''.join(mc))
s=s.replace('__SHOT__',open(shot).read().strip())
open('login.html','w').write(s);print('ok',len(s))
