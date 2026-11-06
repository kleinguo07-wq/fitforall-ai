"""Export the standalone mock admin review, never the supplied real-page HTML."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
class Audit(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key,value in attrs:
            if key in {'src','srcset','poster','action','data-src'}:
                raise ValueError('External dependencies are not allowed')
            if key=='href' and value not in {'../','index.html#home'}:
                raise ValueError('Unexpected navigation')
        if tag in {'iframe','object','embed','base'}:
            raise ValueError('Unexpected embed')
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--requirements',type=Path,required=True)
    a=p.parse_args()
    text=a.source.read_text(encoding='utf-8')
    text=text.replace('<a href="index.html#brief">简版需求</a>','<a href="../">横屏项目</a>').replace('href="公园横屏-交互原型-v1.0.html#home"','href="index.html#home"')
    for pattern in [r'/(?:Users|private|tmp|var)/',r'https?://',r'file://',r'\b(?:fetch|XMLHttpRequest|WebSocket|getUserMedia)\s*\(',r'@import\b',r'url\s*\(']:
        if re.search(pattern,text,re.I):raise ValueError('Unapproved content: '+pattern)
    Audit().feed(text)
    for marker in ['AI全民健身机','AI全民运动站','ADMIN-VIDEO-001','ADMIN-NOTICE-001','公告仅支持在 AI全民运动站展示','未接入真实后台','role="tablist"']:
        if marker not in text:raise ValueError('Missing review rule: '+marker)
    target=ROOT/'projects/landscape/v1.0'
    (target/'admin.html').write_text(text,encoding='utf-8')
    md=a.requirements.read_text(encoding='utf-8').replace('管理后台-评审原型-v1.0.html#videos','admin.html#videos')
    if re.search(r'/(?:Users|private|tmp|var)/|https?://|file://',md):raise ValueError('Private requirement reference')
    (target/'admin-requirements.md').write_text(md,encoding='utf-8')
    print(json.dumps({'destination':'projects/landscape/v1.0/admin.html','sha256':hashlib.sha256(text.encode()).hexdigest()},ensure_ascii=False))
if __name__=='__main__':main()
