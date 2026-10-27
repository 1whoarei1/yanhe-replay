import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import md5 from 'blueimp-md5';
import {parseCourse} from '../extension/core.js';
import {LegacyYanheApi} from '../extension/legacy-api.js';

test('old live and replay IDs remain distinct from course IDs, including copied Markdown links',()=>{
 assert.deepEqual(parseCourse('https://www.yanhekt.cn/live/788579'),{liveId:'788579',legacy:true});
 assert.deepEqual(parseCourse('[直播](https://www.yanhekt.cn/live/788579)'),{liveId:'788579',legacy:true});
 assert.deepEqual(parseCourse('<https://www.yanhekt.cn/session/676261>'),{sessionId:'676261',legacy:true});
 assert.deepEqual(parseCourse('https://www.yanhekt.cn/ReadSession/676261?from=course'),{sessionId:'676261',legacy:true});
 assert.deepEqual(parseCourse('71988','legacy'),{id:'71988',legacy:true});
 assert.deepEqual(parseCourse('https://aita.yanhekt.cn/coursedetail?course_id=71988','legacy'),{id:'71988',legacy:false});
 for(const url of ['https://www.yanhekt.cn.evil.example/live/788579','https://user:pass@www.yanhekt.cn/live/788579','https://www.yanhekt.cn/live/788579/extra'])assert.throws(()=>parseCourse(url));
});

function fixture(data){
 const calls=[];
 const api=new LegacyYanheApi({hash:md5,fetcher:async(raw,options)=>{
  const u=new URL(raw);calls.push({path:u.pathname,params:Object.fromEntries(u.searchParams),headers:options.headers});
  const result=u.pathname==='/v1/course'?{id:Number(u.searchParams.get('id')),name_zh:'（英）纳米材料与物理'}:u.pathname==='/v2/course/session/list'?[]:data;
  return new Response(JSON.stringify({code:0,data:result}));
 }});
 api.authenticate=async()=>{api.token='a'.repeat(32);api.profile={id:7,badge:7};};return {api,calls};
}

test('the reported live link resolves to course 71988 and session 920536 through the official live endpoint',async()=>{
 const {api,calls}=fixture({id:788579,session_id:'920536',session:{id:920536,course_id:71988},course:{id:71988}});
 const ref=await api.resolve(parseCourse('https://www.yanhekt.cn/live/788579'));
 assert.deepEqual(ref,{id:'71988',legacy:true,liveId:'788579',sessionId:'920536'});
 await api.course(ref.id);
 assert.deepEqual(calls[0].params,{id:'788579',with_session:'true',with_course:'true'});
 assert.equal(calls[0].path,'/v1/live');
 assert.equal(calls.find(x=>x.path==='/v1/course').params.id,'71988');
 assert.ok(calls.every(x=>x.params.course_id!=='788579'));
});

test('session links resolve their course and direct course links need no extra lookup',async()=>{
 const {api,calls}=fixture({id:676261,course_id:52238});
 assert.deepEqual(await api.resolve(parseCourse('https://www.yanhekt.cn/session/676261')),{id:'52238',legacy:true,sessionId:'676261'});
 assert.equal(calls[0].path,'/v1/course/session');assert.deepEqual(calls[0].params,{session_id:'676261',with_video:'true'});
 const before=calls.length;assert.deepEqual(await api.resolve({id:'52238',legacy:true}),{id:'52238',legacy:true});assert.equal(calls.length,before);
});

test('missing and contradictory membership data is not replaced with the live ID or source ID',async()=>{
 for(const data of [{id:788579,source_id:71988},{course:{id:71988},session:{course_id:52238}},{course:{id:71988},session_id:'100',session:{id:200}}]){
  const {api}=fixture(data);await assert.rejects(api.resolve({liveId:'788579',legacy:true}),/所属|不一致/);
 }
});

function background(){
 let message,action;const opened=[];
 const runtime={id:'our-extension',getURL:name=>`chrome-extension://our-extension/${name}`,onInstalled:{addListener(){}},onStartup:{addListener(){}},onMessage:{addListener:fn=>{message=fn;}}};
 const chrome={runtime,action:{onClicked:{addListener:fn=>{action=fn;}}},tabs:{create:async value=>{opened.push(value.url);return{id:1};}}};
 const source=readFileSync(new URL('../extension/background.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'');
 runInNewContext(source,{chrome,URL,parseCourse});
 return {message,action,opened};
}

test('floating launcher uses the current SPA route and preserves unresolved legacy source type',async()=>{
 const bg=background();const result=await new Promise(resolve=>bg.message({type:'OPEN_PLAYER',url:'https://www.yanhekt.cn/live/788579'},
  {id:'our-extension',url:'https://www.yanhekt.cn/home',tab:{url:'https://www.yanhekt.cn/home'}},resolve));
 assert.equal(result.ok,true);const u=new URL(bg.opened[0]);assert.equal(u.searchParams.get('legacy_live'),'788579');assert.equal(u.searchParams.has('legacy'),false);
 bg.action({url:'https://www.yanhekt.cn/session/676261'});
 assert.equal(new URL(bg.opened[1]).searchParams.get('legacy_session'),'676261');
});

test('launcher ignores a cross-origin supplied URL and does not silently restore the last course for unknown pages',async()=>{
 const bg=background();await new Promise(resolve=>bg.message({type:'OPEN_PLAYER',url:'https://aita.yanhekt.cn/coursedetail?course_id=110118'},
  {id:'our-extension',url:'https://www.yanhekt.cn/course/71988'},resolve));
 assert.equal(new URL(bg.opened[0]).searchParams.get('legacy'),'71988');
 bg.action({url:'https://www.yanhekt.cn/unsupported'});
 assert.equal(new URL(bg.opened[1]).searchParams.get('source'),'https://www.yanhekt.cn/unsupported');
 bg.action({url:'https://www.yanhekt.cn/login?token=sensitive-test-value#sso'});
 assert.equal(new URL(bg.opened[2]).searchParams.get('source'),'https://www.yanhekt.cn/login');
 assert.ok(!bg.opened[2].includes('sensitive-test-value'));
});
