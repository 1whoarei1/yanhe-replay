import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import md5 from 'blueimp-md5';
import { parseCourse,replayRows,signedUrl,streamsFrom,subtitleRows,jwtFromCookie,tokenFromCookie,referrerRule,vtt,explain,subtitleOffset,shiftSubtitles,subtitleClock } from '../extension/core.js';
import { YanheApi } from '../extension/api.js';

test('new and legacy course IDs cannot be silently confused',()=>{
  assert.deepEqual(parseCourse('https://aita.yanhekt.cn/coursedetail?course_id=110118&tenant_code=21'),{id:'110118',legacy:false});
  assert.deepEqual(parseCourse('https://www.yanhekt.cn/course/77455'),{id:'77455',legacy:true});
  for(const input of ['https://aita.yanhekt.cn.evil.example/?course_id=1','javascript:alert(1)','https://u:p@aita.yanhekt.cn/?course_id=1'])assert.throws(()=>parseCourse(input));
});
test('chapter nesting includes real replays and excludes headings and future live sessions',()=>{
  const row=(id,status,time)=>({id,sub_title:id,playback_status:status,class_begin:time});
  const rows=replayRows([{sub_title:'chapter',playback_status:null,child:[{sub_title:'section',child:[row('b','1',20),row('a',1,10),row('future','0',30)]}]},row('b','1',20)]);
  assert.deepEqual(rows.map(r=>r.id),['a','b']);
  assert.equal(replayRows({'2026':{'09':{'week':[row('date','1',4)]}}})[0].id,'date');
});
test('media signatures agree with the Python skill algorithm and reject credential leaks',()=>{
  const profile={id:123,tenant_id:21,phone:'13000001234'},time=1792468800;
  const url=new URL(signedUrl('https://aita.yanhekt.cn/play/record.mp4?t=old',profile,md5,time));
  const expected=createHash('md5').update('/play/record.mp4'+'123'+'21'+'43210000031'+time).digest('hex');
  assert.equal(url.searchParams.get('t'),`123-${time}-${expected}`);
  for(const raw of ['http://aita.yanhekt.cn/play/a','https://evil.example/play/a','https://yanhekt.cn.evil.example/play/a','https://a:b@aita.yanhekt.cn/play/a'])assert.throws(()=>signedUrl(raw,profile,md5,time));
});
test('only ready known camera streams are offered',()=>{
  assert.deepEqual(streamsFrom({duration:'12',video_list:{a:{type:2,status:2,preview_url:'https://aita.yanhekt.cn/play/s.mp4'},b:{type:3,status:0,preview_url:'https://aita.yanhekt.cn/play/c.m3u8'}}}),{duration:12,streams:{screen:'https://aita.yanhekt.cn/play/s.mp4'}});
});
test('subtitles sort, deduplicate corrected text, and retain genuine gaps',()=>{
  const rows=subtitleRows({list:[{all_content:[{BeginSec:3312,EndSec:3315,Text:'<校正>'},{BeginSec:5,EndSec:8,Text:'旧文本'},{BeginSec:5,EndSec:8,Text:'修订文本'},{BeginSec:9,EndSec:8,Text:'invalid'}]}]});
  assert.deepEqual(rows.map(r=>r.start),[5,3312]);assert.equal(rows[0].text,'修订文本');
  assert.match(vtt(rows),/00:55:12.000 --> 00:55:15.000\n&lt;校正&gt;/);
  assert.match(vtt([{start:71,end:81,text:'previous'},{start:80,end:82,text:'current'}]),/00:01:11.000 --> 00:01:19.999/);
});
test('positive offset delays 1:08 to 1:30 without accumulating or changing raw cues',()=>{
  const rows=[{start:68,end:70,text:'alignment sample'},{start:100,end:103,text:'later sample'}];
  const shifted=shiftSubtitles(rows,22);
  assert.equal(shifted[0].start,90);assert.equal(shifted[0].end,92);assert.equal(shifted[1].start,122);
  assert.equal(subtitleClock(shifted[0].start),'1:30');assert.equal(rows[0].start,68);
  assert.equal(shiftSubtitles(rows,21.5)[0].start,89.5);assert.equal(subtitleClock(89.5),'1:29.5');
  assert.deepEqual(shiftSubtitles(rows,0),rows);assert.match(vtt(shifted),/00:01:30.000 --> 00:01:32.000/);
});
test('early subtitles clip at video zero while wholly negative cues are omitted',()=>{
  const rows=shiftSubtitles([{start:0,end:1,text:'before zero'},{start:1.5,end:3,text:'crosses zero'},{start:5,end:6,text:'later'}],-2);
  assert.equal(subtitleClock(rows[0].start),'−0:02');
  const text=vtt(rows);assert.ok(!text.includes('before zero'));assert.match(text,/00:00:00.000 --> 00:00:01.000\ncrosses zero/);assert.match(text,/00:00:03.000 --> 00:00:04.000\nlater/);
  assert.ok(!text.includes('--> -'));
  assert.equal(subtitleOffset(22.12345),22.123);
  for(const value of [Infinity,NaN,'bad',86401,-86401])assert.throws(()=>subtitleOffset(value));
});
test('auth and referrer access stay within the extension and Yanhe',()=>{
  const token='eyJhbGciOiJIUzI1NiJ9.abc.def';assert.equal(jwtFromCookie(encodeURIComponent(JSON.stringify(token))),token);
  const rule=referrerRule('abcdefghijklmnopabcdefghijklmnop');assert.deepEqual(rule.condition.initiatorDomains,['abcdefghijklmnopabcdefghijklmnop']);assert.deepEqual(rule.condition.requestDomains,['yanhekt.cn']);
  assert.ok(!explain(new Error(`failed https://aita.yanhekt.cn/play/a?t=secret ${token}`)).includes('secret'));
});
test('API reads browser cookies, keeps only signing fields in memory, and detects expired auth',async()=>{
  const calls=[];const api=new YanheApi({hash:md5,cookies:{getAll:async filter=>{assert.equal(filter.name,'_token');assert.equal(filter.domain,'yanhekt.cn');assert.equal(filter.url,undefined);return[{domain:'.yanhekt.cn',value:'eyJhbGciOiJIUzI1NiJ9.abc.def'}];}},fetcher:async(url,options)=>{
    calls.push({url,options});return new Response(JSON.stringify({code:200,params:{id:1,tenant_id:21,phone:'13000000000',unneeded:'private'}}),{status:200});
  }});
  await api.authenticate();assert.deepEqual(Object.keys(api.profile),['id','tenant_id','phone']);assert.equal(calls.length,1);await api.authenticate();assert.equal(calls.length,1);
  api.fetcher=async()=>new Response('{}',{status:403});await assert.rejects(api.json('/courseapi/v3/example'),/登录已失效/);assert.equal(api.profile,null);assert.equal(api.token,null);
});

test('portal bearer parsing supports serialized non-JWT and repeated URL encoding',()=>{
  const token='portal-opaque-0123456789';
  const php=`a:2:{i:0;s:6:"_token";i:1;s:${token.length}:"${token}";}`;
  assert.equal(tokenFromCookie(encodeURIComponent(encodeURIComponent(php))),token);
  assert.equal(tokenFromCookie(encodeURIComponent(encodeURIComponent('eyJhbGciOiJIUzI1NiJ9.abc.def'))),'eyJhbGciOiJIUzI1NiJ9.abc.def');
  assert.equal(tokenFromCookie('a:1:{s:5:"other";s:6:"secret";}'),null);
  assert.equal(tokenFromCookie('a:2:{i:0;s:6:"_token";i:1;s:5:"a\r\nb";}'),null);
});

test('expired root cookie does not hide valid portal cookie; other tenants are excluded',async()=>{
  const expired='eyJhbGciOiJIUzI1NiJ9.expired.signature',valid='portal-opaque-0123456789',seen=[];
  const api=new YanheApi({hash:md5,cookies:{getAll:async()=>[
    {domain:'other.yanhekt.cn',value:'eyJhbGciOiJIUzI1NiJ9.other.signature'},
    {domain:'.yanhekt.cn',path:'/',value:expired},
    {domain:'aita.yanhekt.cn',path:'/portal/',value:`a:2:{i:0;s:6:"_token";i:1;s:${valid.length}:"${valid}";}`}
  ]},fetcher:async(url,options)=>{
    seen.push(options.headers.Authorization);
    return new Response(JSON.stringify(options.headers.Authorization===`Bearer ${valid}`?{code:200,params:{id:1,tenant_id:21,phone:'13000000000'}}:{code:401}),{status:200});
  }});
  await api.authenticate();assert.deepEqual(seen,[`Bearer ${expired}`,`Bearer ${valid}`]);assert.equal(api.profile.id,1);
});

test('content login bridge rejects webpages, other extensions and unrelated messages',()=>{
  const id='test-extension',player=`chrome-extension://${id}/player.html`;let handler,reads=0;
  const window={};window.top=window;
  runInNewContext(readFileSync(new URL('../extension/auth-content.js',import.meta.url),'utf8'),{
    window,location:{origin:'https://aita.yanhekt.cn',href:'https://aita.yanhekt.cn/portal/'},URL,
    document:{get cookie(){reads++;return '_token=test_cookie; unrelated=do_not_read';}},
    chrome:{runtime:{id,getURL:name=>`chrome-extension://${id}/${name}`,onMessage:{addListener:listener=>{handler=listener;}}}}
  });
  let reply;
  const respond=value=>{reply=value;};
  handler({type:'READ_AUTH_COOKIE'},{id,url:'https://aita.yanhekt.cn/portal/'},respond);
  handler({type:'READ_AUTH_COOKIE'},{id:'other-extension',url:player},respond);
  handler({type:'UNRELATED'},{id,url:player},respond);
  assert.equal(reply,undefined);assert.equal(reads,0);
  handler({type:'READ_AUTH_COOKIE'},{id,url:player+'?course=110118'},respond);
  assert.equal(JSON.stringify(reply),JSON.stringify({values:['test_cookie']}));assert.equal(reads,1);
});

test('open aita page can provide the named login cookie without persisting it',async()=>{
  const token='eyJhbGciOiJIUzI1NiJ9.page.signature';
  const api=new YanheApi({cookies:{getAll:async()=>[]},tabs:{
    query:async filter=>{assert.deepEqual(filter,{url:['https://aita.yanhekt.cn/*']});return[{id:23},{id:24}];},
    sendMessage:async(id,message,options)=>{assert.deepEqual(message,{type:'READ_AUTH_COOKIE'});assert.equal(options.frameId,0);if(id===23)throw new Error('tab closed');return{values:[token]};}
  },fetcher:async(url,options)=>{assert.equal(options.headers.Authorization,`Bearer ${token}`);return new Response(JSON.stringify({code:200,params:{id:1,tenant_id:21,phone:'13000000000'}}));}});
  await api.authenticate();assert.equal(api.token,token);api.reset();assert.equal(api.token,null);
  await assert.rejects(new YanheApi({cookies:{getAll:async()=>[]}}).authenticate(),/同一 Edge 个人资料/);
});
test('media probe distinguishes missing files from servers that do not implement HEAD',async()=>{
  let status=404,type='text/html';
  const api=new YanheApi({hash:md5,fetcher:async(url,options)=>{
    assert.equal(options.method,'HEAD');assert.equal(options.credentials,'include');assert.ok(new URL(url).searchParams.has('t'));
    return new Response(null,{status,headers:{'Content-Type':type}});
  }});api.profile={id:1,tenant_id:21,phone:'13000000000'};
  assert.equal((await api.probeMedia('https://aita.yanhekt.cn/play/test.mp4')).ok,false);
  status=405;assert.equal((await api.probeMedia('https://aita.yanhekt.cn/play/test.mp4')).ok,true);
  status=200;assert.equal((await api.probeMedia('https://aita.yanhekt.cn/play/test.mp4')).ok,false);
  type='video/mp4';assert.equal((await api.probeMedia('https://aita.yanhekt.cn/play/test.mp4')).ok,true);
});
