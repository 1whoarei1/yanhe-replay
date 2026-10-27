import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCourse } from '../extension/core.js';
import { liveRows, lectureMode, liveStreams, liveEdge } from '../extension/live-core.js';
import { YanheApi } from '../extension/api.js';

test('live deep links retain the lesson without trusting tenant input',()=>{
  assert.deepEqual(parseCourse('https://aita.yanhekt.cn/livingroom?course_id=102154&sub_id=1630190&tenant_code=21'),{id:'102154',legacy:false,subId:'1630190'});
  assert.throws(()=>parseCourse('https://aita.yanhekt.cn/livingroom?course_id=1&sub_id=../2'));
});

test('live catalogue walks chapters, deduplicates, and keeps replays separate',()=>{
  const row=(id,status,playback='0')=>({id,sub_title:id,type:'course_live',sub_status:status,playback_status:playback,class_begin:Number(id)});
  const list=liveRows({date:[{sub_title:'chapter',child:[row('3','2'),row('1','1'),row('2','6'),row('4','6','1')]}],duplicate:row('1','1')});
  assert.deepEqual(list.map(r=>[r.id,r.mode]),[['1','live'],['3','upcoming'],['2','ended']]);
});

test('active live state takes priority over stale recorded video fields',()=>{
  const video_list={x:{type:'2',status:'2',preview_url:'https://aita.yanhekt.cn/play/a.mp4'}};
  assert.equal(lectureMode({sub_type:'course_live',sub_status:'1',video_list}),'live');
  assert.equal(lectureMode({sub_type:'course_live',sub_status:'2'}),'upcoming');
  assert.equal(lectureMode({sub_type:'course_live',sub_status:'6'}),'ended');
  assert.equal(lectureMode({sub_type:'course_live',sub_status:'6',video_list}),'replay');
});

test('live candidates use platform-supplied HTTPS HLS and FLV across three known views',()=>{
  const raw={live_url:{output:{m3u8:'https://clive14.yanhekt.cn/main.m3u8',m3u8_lhd:'http://livepgc.yanhekt.cn/a.m3u8',flv:'https://clive14.yanhekt.cn/main.flv',flv_lhd:'https://evil.example/main.flv'},output_ppt:'https://clive14.yanhekt.cn/ppt.m3u8',output_student:{m3u8:'https://u:p@clive14.yanhekt.cn/x.m3u8',flv:'https://clive14.yanhekt.cn/student.flv'},output_tts:{m3u8:'https://clive14.yanhekt.cn/unknown.m3u8'}}};
  const result=liveStreams(raw);
  assert.deepEqual(Object.keys(result.streams),['classroom','screen','student']);
  assert.deepEqual(result.candidates.classroom.map(c=>c.format),['hls','flv']);
  assert.equal(result.candidates.student.length,1);
});

function fixture(permission,status='1') {
  const calls=[],api=new YanheApi({cookies:{getAll:async()=>[{domain:'aita.yanhekt.cn',value:'eyJabc.test.sig'}]},fetcher:async(raw,options)=>{
    const url=new URL(raw);calls.push({url,options});
    const body=url.pathname.endsWith('infosimple')?{code:200,params:{id:7,tenant_id:21,phone:'13000000000',account:'actual-account'}}:
      url.pathname.includes('study-auth')?{code:200,data:{hasPermission:permission}}:
      {code:0,data:{sub_type:'course_live',sub_status:status,live_url:{output:{m3u8:'https://clive14.yanhekt.cn/a.m3u8'}}}};
    return new Response(JSON.stringify(body));
  }});
  return {api,calls};
}

test('live authorization uses the actual signed-in account and never the supplied course tenant',async()=>{
  const {api,calls}=fixture(true);const info=await api.lecture('102154','1630190');
  const request=calls.find(c=>c.url.pathname.includes('study-auth'));
  assert.equal(request.options.headers['Tenant-Id'],'21');assert.equal(request.options.headers.username,'actual-account');
  assert.equal(request.options.headers.Authorization,'Bearer eyJabc.test.sig');
  assert.equal(info.mode,'live');assert.equal(info.streams.classroom,'https://clive14.yanhekt.cn/a.m3u8');
  assert.deepEqual(Object.keys(api.profile),['id','tenant_id','phone']);
  api.reset();assert.equal(api.account,null);
});

test('the page permission flag is diagnostic and does not suppress platform-provided live sources',async()=>{
  for (const permission of [false,undefined,'true',1]) {
    const {api,calls}=fixture(permission);const info=await api.lecture('102154','1630190');
    assert.equal(info.pagePermission,permission===false?false:null);
    assert.equal(info.streams.classroom,'https://clive14.yanhekt.cn/a.m3u8');
    assert.ok(calls.every(c=>c.url.hostname==='aita.yanhekt.cn'));
  }
});

test('page permission refresh and actual media rejection remain separate',async()=>{
  const {api,calls}=fixture(true);await api.lecture('1','2');
  const original=api.fetcher;
  api.fetcher=(raw,options)=>String(raw).includes('study-auth')?Promise.resolve(new Response(JSON.stringify({code:200,data:{hasPermission:false}}))):original(raw,options);
  const info=await api.lecture('1','2');assert.equal(info.pagePermission,false);
  api.fetcher=async()=>new Response('',{status:403});
  const media=await api.probeMedia(info.streams.classroom);assert.equal(media.ok,false);assert.equal(media.status,403);
  assert.ok(calls.length>=4);
});

test('upcoming live lessons expose no media regardless of the page permission flag',async()=>{
  const {api}=fixture(true,'2');const info=await api.lecture('1','2');
  assert.equal(info.mode,'upcoming');assert.deepEqual(info.streams,{});
});

test('go live uses HLS sync position or the last seekable/buffered range',()=>{
  const ranges={length:2,start:i=>i?30:0,end:i=>i?40:10};
  assert.equal(liveEdge({}, {liveSyncPosition:37}),37);
  assert.equal(liveEdge({seekable:ranges}),39);
  assert.equal(liveEdge({seekable:{length:0},buffered:ranges}),39);
  assert.equal(liveEdge({}),null);
});
