(function(root){
'use strict';
const catalog=[
{id:'heel-raise',name:'提踵',type:'single',duration:30,kcal:3,audiences:['senior'],warm:false,color:'blue',tag:'体能'},
{id:'side-leg-swing',name:'单侧外摆腿',type:'single',duration:30,kcal:3,audiences:['senior'],warm:false,color:'mint',tag:'体能'},
{id:'front-raise',name:'前侧平举',type:'single',duration:30,kcal:2,audiences:['senior'],warm:false,color:'lavender',tag:'体能'},
{id:'push-sky',name:'徒手推天',type:'single',duration:30,kcal:2,audiences:['senior'],warm:false,color:'amber',tag:'体能'},
{id:'seated-knee-raise',name:'坐姿收腹提膝',type:'single',duration:30,kcal:3,audiences:['senior'],warm:false,color:'blue',tag:'体能'},
{id:'seated-side-bend',name:'坐姿身体侧屈',type:'single',duration:30,kcal:2,audiences:['senior'],warm:false,color:'mint',tag:'体能'},
{id:'baduan',name:'热身操',type:'ai',duration:720,kcal:30,audiences:['senior','adult'],warm:false,screen:false,color:'mint',tag:'AI 跟练'},
{id:'baduan-full',name:'八段锦',type:'ai',duration:900,kcal:38,audiences:['senior'],warm:false,color:'blue',tag:'AI 跟练'},
{id:'jump',name:'双脚跳绳',type:'single',duration:30,kcal:6,audiences:['youth','adult'],warm:false,color:'blue',tag:'单项体能'},
{id:'taichi',name:'八式太极拳',type:'ai',duration:600,kcal:22,audiences:['senior','adult'],warm:false,color:'lavender',tag:'AI 跟练'},
{id:'wuqinxi',name:'五禽戏',type:'ai',duration:900,kcal:35,audiences:['senior'],warm:false,color:'amber',tag:'AI 跟练'},
{id:'horse',name:'蹲马步',type:'single',duration:30,kcal:3,audiences:['adult'],warm:false,color:'blue',tag:'单项体能'}];
// Local prototype keys; production games reuse the existing platform IDs and media.
const funGames=[['demo-fruit','切水果'],['demo-rhythm','节奏跳跃'],['demo-touch','顺序摸球'],['demo-punch','拳脚快打']].map(([id,name])=>({id,name,type:'game',duration:30,kcal:0,audiences:['senior','adult','youth'],warm:false,color:'amber',tag:'趣味运动'}));
catalog.push(...funGames);
const seniorContent=['heel-raise','side-leg-swing','front-raise','push-sky','seated-knee-raise','seated-side-bend','baduan-full','taichi','wuqinxi'];
const defaults={mode:'video',poolMode:'recommended',audience:'senior',fixed:[...seniorContent,...funGames.map(c=>c.id)],idle:60,imageInterval:8,images:[]};
function pool(config){return config.poolMode==='fixed'?config.fixed.map(id=>catalog.find(c=>c.id===id)).filter(c=>c&&c.screen!==false):catalog.filter(c=>c.screen!==false&&c.audiences.includes(config.audience));}
function slice(course){if(!Number.isFinite(course.duration)||course.duration<=0)throw Error('视频时长必须为正数');return {start:0,end:Math.min(30,course.duration),repeats:1};}
function day(timestamp){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));}
function eligible(record,t){return !!record.id&&!!record.userId&&Number.isFinite(record.timestamp)&&['normal','early'].includes(record.reason)&&Number.isFinite(t)&&t>=0&&Number.isFinite(record.seconds)&&record.seconds>=0&&Number.isFinite(record.kcal)&&record.kcal>=0&&(record.reason==='normal'||record.seconds>=t);}
function settle(records,record,t){if(records.some(r=>r.id===record.id))return {records,added:false,valid:eligible(record,t)};const valid=eligible(record,t);return {records:valid?[...records,record]:records,added:valid,valid};}
function totals(records,userId){const mine=records.filter(r=>r.userId===userId);return {days:new Set(mine.map(r=>day(r.timestamp))).size,kcal:mine.reduce((a,r)=>a+r.kcal,0),seconds:mine.reduce((a,r)=>a+r.seconds,0)};}
const api={catalog,seniorContent,defaults,pool,slice,day,eligible,settle,totals};if(typeof module!=='undefined')module.exports=api;root.FitCore=api;
})(typeof window!=='undefined'?window:globalThis);
