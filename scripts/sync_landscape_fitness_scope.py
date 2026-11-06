"""Publish an allowlisted fitness scope summary, without raw sheets or source fields."""
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);a=p.parse_args();s=json.loads(a.source.read_text())['fitness_scope']
 assert len(s['selected'])==3 and len(s['deferred'])==31
 lines=['# v1.0 体能一期范围','','更新：'+s['date'],'',s['decision'],'',s['status'],'','## 本期3项','','全身0、上肢1、核心0、下肢2；分类保留，空分类不放占位动作。','','| 动作 | 分类 | 原表方向/强度 | 上线前核对 |','| --- | --- | --- | --- |']
 for x in s['selected']:lines.append('| '+' | '.join([x['name'],x['category'],x['orientation']+' / '+x['intensity'],x['verification']])+' |')
 lines+=['','## 筛选与验收']+['- '+x for x in s['rules']]+['- '+x for x in s['acceptance']]+['','## 后续31项','','这些项目不属于本期交付，后续按素材、姿态、强度、识别及资源重新评估，不承诺全部下期上线。','','| 原动作 | 原分类 | 延期原因 |','| --- | --- | --- |']
 for x in s['deferred']:lines.append('| '+' | '.join([x['name'],x['category'],x['reason']])+' |')
 lines+=['','[返回大屏原型](index.html#library)',''];text='\n'.join(lines)
 if re.search(r'/(?:Users|private|tmp|var)/|https?://|source_range|itemId',text):raise ValueError('Private scope content')
 (ROOT/'projects/landscape/v1.0/fitness-scope.md').write_text(text,encoding='utf-8');print('Published 3 selected / 31 deferred fitness scope')
if __name__=='__main__':main()
