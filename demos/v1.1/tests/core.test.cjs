const assert=require('node:assert/strict');
const C=require('../core.js');
for(const type of ['single','ai']){
 for(const duration of [10,30,720])assert.deepEqual(C.slice({type,duration}),{start:0,end:Math.min(30,duration),repeats:1});
 for(const duration of [0,-1,NaN,Infinity,undefined])assert.throws(()=>C.slice({type,duration}));
}
assert.deepEqual(C.pool({...C.defaults,poolMode:'fixed',fixed:['jump','baduan']}).map(c=>c.id),['jump','baduan']);
assert.equal(C.pool({...C.defaults,poolMode:'fixed',fixed:[]}).length,0);
assert.deepEqual(C.pool({...C.defaults,poolMode:'fixed',fixed:['demo-punch','heel-raise','demo-fruit']}).map(c=>c.name),['拳脚快打','提踵','切水果']);
assert.deepEqual(C.pool({...C.defaults,poolMode:'recommended',audience:'senior'}).map(c=>c.name),['提踵','单侧外摆腿','前侧平举','徒手推天','坐姿收腹提膝','坐姿身体侧屈','热身操','八段锦','八式太极拳','五禽戏','切水果','节奏跳跃','顺序摸球','拳脚快打']);
console.log('PASS: current preview boundaries and ordered/default content pools');
