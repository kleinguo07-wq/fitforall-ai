"""Publish an allowlisted fitness scope summary without raw source material."""
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);a=p.parse_args();s=json.loads(a.source.read_text())['fitness_scope'];c=s['counts']
 assert len(s['selected'])==c['selected'] and len(s['deferred'])==c['deferred'] and c['original']==c['teaching']+c['supplemental']==c['selected']+c['deferred']
 counts='、'.join(k+str(c[k]) for k in ['全身','上肢','核心','下肢'])
 lines=['# v1.0 体能一期范围','','更新：'+s['date'],'',s['decision'],'',s['status'],'','## 内容基础','',f"教学屏名称清单{c['teaching']}项，原表补充记录{c['supplemental']}项，合计{c['original']}条；原34项不再作为全集。",'',s['source']['supplemental_note'].replace('itemId','正式ID参照'),'','教学屏JSON只有名称，未提供分类、强度、朝向、正式ID或媒体。以下分类与适用性属于本次选型判断；不符合原版示范时延期，不另行改编。','',f"## 本期{c['selected']}项候选",'',counts+'；核心保留空态，不放占位动作。','','| 动作 | 分类 | 来源 | 方向/强度信息 | 接入前核对 |','| --- | --- | --- | --- | --- |']
 for x in s['selected']:lines.append('| '+' | '.join([x['name'],x['category'],x['source_kind'],x['orientation']+' / '+x['intensity'],x['verification']])+' |')
 lines+=['','## 筛选与验收']+['- '+x for x in s['rules']]+['- '+x for x in s['acceptance']]+['',f"## 后续{c['deferred']}项",'','以下项目不属于一期交付；原因是选型判断，后续需核对原版，不承诺全部下期上线。分类未取得时保持待归类。','','| 原动作 | 分类记录 | 来源 | 后续原因 |','| --- | --- | --- | --- |']
 for x in s['deferred']:lines.append('| '+' | '.join([x['name'],x['category'],x['source_kind'],x['reason']])+' |')
 lines+=['','## 旧表独有名称','', '、'.join(x['name'] for x in s['source_reconciliation'])+'：原表无正式ID，且不在教学屏61项中。仅保留交叉核对，不自动当作额外新增动作或合并近似名称。','','[返回大屏原型](index.html#library)',''];text='\n'.join(lines)
 if re.search(r'/(?:Users|private|tmp|var)/|https?://|source_range|itemId',text):raise ValueError('Private scope content')
 (ROOT/'projects/landscape/v1.0/fitness-scope.md').write_text(text,encoding='utf-8');print(f"Published {c['selected']} candidates / {c['deferred']} deferred fitness scope")
if __name__=='__main__':main()
