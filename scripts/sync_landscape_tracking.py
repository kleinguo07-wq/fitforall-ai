"""Export the standalone tracking requirement, with no production collector."""
import argparse
import hashlib
from html.parser import HTMLParser
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
class Audit(HTMLParser):
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k in {'src','srcset','poster','action','data-src'}:raise ValueError('Unexpected dependency')
            if k=='href' and v not in {'../','index.html#home','admin.html#videos','tracking.md','#events','#common','#metrics','#acceptance'}:raise ValueError('Unapproved navigation')
        if tag in {'iframe','object','embed','base'}:raise ValueError('Unexpected embedded content')
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',required=True,type=Path)
    p.add_argument('--text',required=True,type=Path)
    a=p.parse_args()
    text=a.source.read_text(encoding='utf-8').replace('href="index.html#brief">← 简版需求','href="../">← 横屏项目').replace('公园横屏-交互原型-v1.0.html#home','index.html#home').replace('管理后台-评审原型-v1.0.html#videos','admin.html#videos').replace('埋点需求-v1.0.md','tracking.md')
    md=a.text.read_text(encoding='utf-8').replace('埋点需求-v1.0.html','tracking.html')
    for value in (text,md):
        for pattern in [r'/(?:Users|private|tmp|var)/',r'https?://',r'file://',r'\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(',r'@import\b',r'url\s*\(']:
            if re.search(pattern,value,re.I):raise ValueError('Unapproved tracking content: '+pattern)
    Audit().feed(text)
    if len(re.findall(r'<details class="event" ',text))!=24:raise ValueError('Unexpected event group count')
    for marker in ['result_training_start','result_training_settlement','result_landscape_notice_apply','原型不发送生产埋点']:
        if marker not in text:raise ValueError('Missing required tracking rule')
    dest=ROOT/'projects/landscape/v1.0'
    (dest/'tracking.html').write_text(text,encoding='utf-8')
    (dest/'tracking.md').write_text(md,encoding='utf-8')
    print('Tracking requirement exported; SHA256 '+hashlib.sha256(text.encode()).hexdigest())
if __name__=='__main__':main()
