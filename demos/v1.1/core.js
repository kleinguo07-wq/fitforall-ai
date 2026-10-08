(function(root){
'use strict';
const catalog=[
{id:'warm',name:'舒缓热身操',type:'ai',duration:180,kcal:8,preview:[15,120],audiences:['senior','adult','youth'],warm:true,screen:false,color:'mint',tag:'签到热身 · 平台固定'},
{id:'heel-raise',name:'提踵',type:'single',duration:30,kcal:3,preview:[0,10],audiences:['senior'],warm:false,color:'blue',tag:'体能'},
{id:'side-leg-swing',name:'单侧外摆腿',type:'single',duration:30,kcal:3,preview:[0,10],audiences:['senior'],warm:false,color:'mint',tag:'体能'},
{id:'front-raise',name:'前侧平举',type:'single',duration:30,kcal:2,preview:[0,10],audiences:['senior'],warm:false,color:'lavender',tag:'体能'},
{id:'push-sky',name:'徒手推天',type:'single',duration:30,kcal:2,preview:[0,10],audiences:['senior'],warm:false,color:'amber',tag:'体能'},
{id:'seated-knee-raise',name:'坐姿收腹提膝',type:'single',duration:30,kcal:3,preview:[0,10],audiences:['senior'],warm:false,color:'blue',tag:'体能'},
{id:'seated-side-bend',name:'坐姿身体侧屈',type:'single',duration:30,kcal:2,preview:[0,10],audiences:['senior'],warm:false,color:'mint',tag:'体能'},
{id:'baduan',name:'热身操',type:'ai',duration:720,kcal:30,preview:[60,360],audiences:['senior','adult'],warm:false,color:'mint',tag:'AI 跟练'},
{id:'baduan-full',name:'八段锦',type:'ai',duration:900,kcal:38,preview:[60,600],audiences:['senior'],warm:false,color:'blue',tag:'AI 跟练'},
{id:'jump',name:'双脚跳绳',type:'single',duration:30,kcal:6,preview:[0,10],audiences:['youth','adult'],warm:false,color:'blue',tag:'单项体能'},
{id:'taichi',name:'八式太极拳',type:'ai',duration:600,kcal:22,preview:[45,240],audiences:['senior','adult'],warm:false,color:'lavender',tag:'AI 跟练'},
{id:'wuqinxi',name:'五禽戏',type:'ai',duration:900,kcal:35,preview:[60,600],audiences:['senior'],warm:false,color:'amber',tag:'AI 跟练'},
{id:'horse',name:'蹲马步',type:'single',duration:30,kcal:3,preview:[0,10],audiences:['adult'],warm:false,color:'blue',tag:'单项体能'}];
const seniorContent=['heel-raise','side-leg-swing','front-raise','push-sky','seated-knee-raise','seated-side-bend','baduan','baduan-full','taichi','wuqinxi'];
const defaults={mode:'video',poolMode:'recommended',audience:'senior',fixed:[...seniorContent],warm:['warm'],threshold:10,idle:60,imageInterval:8,images:[],ranges:Object.fromEntries(catalog.map(c=>[c.id,c.preview]))};
function pool(config){return config.poolMode==='fixed'?config.fixed.map(id=>catalog.find(c=>c.id===id)).filter(Boolean):catalog.filter(c=>c.screen!==false&&c.audiences.includes(config.audience));}
function slice(course,range,random=Math.random){if(course.type==='single')return {start:0,end:range[1],repeats:3};if(!range||!range.every(Number.isFinite)||range[0]<0||range[1]>course.duration||range[1]-range[0]<30)throw Error('长课预览区间需至少 30 秒，且不能超出视频时长');const start=range[0]+random()*(range[1]-range[0]-30);return {start,end:start+30,repeats:1};}
function day(timestamp){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));}
function eligible(record,t){return !!record.id&&!!record.userId&&Number.isFinite(record.timestamp)&&['normal','early'].includes(record.reason)&&Number.isFinite(t)&&t>=0&&Number.isFinite(record.seconds)&&record.seconds>=0&&Number.isFinite(record.kcal)&&record.kcal>=0&&(record.reason==='normal'||record.seconds>=t);}
function settle(records,record,t){if(records.some(r=>r.id===record.id))return {records,added:false,valid:eligible(record,t)};const valid=eligible(record,t);return {records:valid?[...records,record]:records,added:valid,valid};}
function totals(records,userId){const mine=records.filter(r=>r.userId===userId);return {days:new Set(mine.map(r=>day(r.timestamp))).size,kcal:mine.reduce((a,r)=>a+r.kcal,0),seconds:mine.reduce((a,r)=>a+r.seconds,0)};}
const levels={days:[1,3,7,14,30,60,100,180,365],kcal:[50,100,300,500,1000,2000,5000,10000,20000],minutes:[10,30,60,150,300,600,1500,3000,6000]};
function progress(value,steps){const previous=[...steps].reverse().find(n=>n<=value)||0,next=steps.find(n=>n>value),ratio=next?Math.min(1,Math.max(0,value/next)):value>0?1:0;return {previous:previous||null,next:next||null,remaining:next?Math.max(0,next-value):0,ratio};}
const api={catalog,seniorContent,defaults,pool,slice,day,eligible,settle,totals,levels,progress};if(typeof module!=='undefined')module.exports=api;root.FitCore=api;
})(typeof window!=='undefined'?window:globalThis);
