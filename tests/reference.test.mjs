import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReference,selectionReference,referenceQuery,referenceInput} from '../extension/reference.js';
import {parseCourse} from '../extension/core.js';
import {LegacyYanheApi} from '../extension/legacy-api.js';

test('session and course 71990 remain different typed references with the observed parent mapping',async()=>{
 const calls=[],api=new LegacyYanheApi({fetcher:async raw=>{const u=new URL(raw);calls.push(u);return new Response(JSON.stringify({code:0,data:{id:71990,course_id:9397,course:{id:9397,name_zh:'离散数学Ⅱ'}}}));},hash:()=>''});
 api.authenticate=async()=>{};
 const ref=await api.resolve(parseCourse('https://www.yanhekt.cn/session/71990'));
 assert.equal(ref.id,'9397');assert.equal(ref.sessionId,'71990');assert.equal(calls[0].searchParams.get('session_id'),'71990');
 assert.equal(referenceInput(ref),'https://www.yanhekt.cn/session/71990');
 assert.equal(referenceInput(parseCourse('https://www.yanhekt.cn/course/71990')),'https://www.yanhekt.cn/course/71990');
 assert.equal(referenceQuery(ref).toString(),'legacy_session=71990');
});
test('legacy selection retains both session and video part rather than the course number',()=>{
 const course={id:'9397',legacy:true};
 const first=selectionReference(course,{id:'71990:301'}),second=selectionReference(course,{id:'71990:302'}),next=selectionReference(course,{id:'72000:303'});
 assert.equal(first.id,'9397');assert.equal(second.sessionId,'71990');assert.equal(second.videoId,'302');
 assert.equal(referenceQuery(second).toString(),'legacy_session=71990&legacy_video=302');
 assert.equal(referenceInput(next),'https://www.yanhekt.cn/session/72000');
 assert.equal(referenceQuery(selectionReference(course,{id:'live:71990'})).toString(),'legacy_live=71990');
});
test('saved references accept only validated typed IDs and never retain credentials or signed URLs',()=>{
 assert.deepEqual(safeReference({legacy:true,id:'9397',sessionId:'71990',videoId:'302',token:'secret',url:'https://cvideo.yanhekt.cn/signed?token=secret'}),{legacy:true,id:'9397',sessionId:'71990',videoId:'302'});
 for(const invalid of [null,[],{legacy:'true',id:'1'},{legacy:true,id:'9397',sessionId:'abc'},{legacy:false,id:'9397',sessionId:'71990'},{legacy:true,id:'9397',videoId:'302'},{legacy:true,id:'9397',subId:'71990'}])assert.equal(safeReference(invalid),null);
 assert.equal(selectionReference({legacy:true,id:'9397'},{id:'not-a-video'}),null);
});

test('a pending or unavailable session is a typed target without retaining the previous video',()=>{
 const ref=selectionReference({legacy:true,id:'65802',indexSource:'autoslides'},{id:'891269:pending'});
 assert.deepEqual(ref,{legacy:true,id:'65802',indexSource:'autoslides',sessionId:'891269'});
 assert.equal(referenceQuery(ref).toString(),'legacy_session=891269&index_source=autoslides');
 assert.equal(referenceInput(ref),'https://www.yanhekt.cn/session/891269');
});
test('modern replay and legacy live references retain their own entity types',()=>{
 const modern=selectionReference({id:'71990',legacy:false},{id:'160001'});
 assert.equal(referenceQuery(modern).toString(),'course=71990&sub_id=160001');
 assert.deepEqual(parseCourse(referenceInput(modern)),{id:'71990',subId:'160001',legacy:false});
 const live=safeReference({legacy:true,id:'9397',liveId:'71990',sessionId:'72000'});
 assert.equal(referenceQuery(live).toString(),'legacy_live=71990');assert.equal(referenceInput(live),'https://www.yanhekt.cn/live/71990');
});
