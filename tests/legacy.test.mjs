import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import md5 from 'blueimp-md5';
import {LegacyYanheApi} from '../extension/legacy-api.js';
import {legacyHeaders,legacyToken,legacySignedUrl,legacyReplays,legacyStreams,legacyReferrerRule,parseLegacyCaptions} from '../extension/legacy-core.js';

test('legacy media signing is idempotent and never uses the modern signing scheme',()=>{
  const raw='https://cvideo.yanhekt.cn/record/test.m3u8',url=legacySignedUrl(raw,'media_fixture',md5,1792470000);
  assert.equal(legacySignedUrl(url,'media_fixture',md5,1792470000),url);
  const parsed=new URL(url);assert.ok(parsed.pathname.includes(md5('1138b69dfef641d9d7ba49137d2d4875_200')));
  assert.equal(parsed.searchParams.get('Xvideo_Token'),'media_fixture');assert.equal(parsed.searchParams.has('t'),false);
  assert.equal(legacyHeaders('user_fixture',md5,123).Authorization,'Bearer user_fixture');
  assert.equal(legacyToken('a'.repeat(32)),'a'.repeat(32));assert.equal(legacyToken('eyJ.test.jwt'),null);
  assert.throws(()=>legacySignedUrl('https://evil.example/test.m3u8','media_fixture',md5));
  const rule=legacyReferrerRule('own-extension');assert.deepEqual(rule.condition.initiatorDomains,['own-extension']);assert.equal(rule.id,2);
});
test('old sessions keep real video parts and decode platform VTT/SRT without ASR',()=>{
  const video={id:88,duration:'100',main:'https://cvideo.yanhekt.cn/a.m3u8',vga:'https://cvideo.yanhekt.cn/b.m3u8'};
  const rows=legacyReplays([{id:4,title:'第4节',started_at:'2024-12-26 08:00:00',videos:[video,{...video,id:89}]},{id:5,videos:[]}]);
  assert.deepEqual(rows.map(r=>r.id),['4:88','4:89']);assert.match(rows[1].title,/片段2/);assert.equal(legacyStreams(video).duration,100);
  assert.equal(parseLegacyCaptions('WEBVTT\n\n00:01:08.000 --> 00:01:10.000\n<b>一句话</b>\n')[0].start,68);
  assert.equal(parseLegacyCaptions('1\n00:01:08,000 --> 00:01:10,000\n一句话\n')[0].text,'一句话');
});
test('old login comes only from old tabs and an authenticated empty course remains empty',async()=>{
  let mediaRequests=0;const token='b'.repeat(32),paths=[];
  const api=new LegacyYanheApi({hash:md5,cookies:{getAll:()=>{throw new Error('must not use modern cookie');}},tabs:{query:async filter=>{assert.deepEqual(filter.url,['https://www.yanhekt.cn/*']);return[{id:1}];},sendMessage:async(_id,message)=>{assert.equal(message.type,'READ_LEGACY_AUTH');return{token};}},fetcher:async(url,options)=>{
    assert.equal(options.headers.Authorization,`Bearer ${token}`);const path=new URL(url).pathname;paths.push(path);
    const data=path==='/v1/user'?{id:7,badge:'fixture-badge',phone:'not-retained'}:path==='/v1/auth/video/token'?(mediaRequests++,{token:'resource_token',expired_at:600,now:0}):path==='/v1/course'?{id:77464,name_zh:'旧课程',school_year:'2026-2027',semester:1}:[];
    return new Response(JSON.stringify({code:0,data}));
  }});
  const course=await api.course('77464');assert.equal(course.legacy,true);assert.equal(course.title,'旧课程');assert.deepEqual(course.replays,[]);assert.deepEqual(Object.keys(api.profile),['id','badge']);
  await api.prepareMedia();assert.equal(mediaRequests,1);api.videoExpiry=0;await Promise.all([api.prepareMedia(),api.prepareMedia()]);assert.equal(mediaRequests,2);assert.ok(paths.every(path=>!path.startsWith('/courseapi/')));
});
test('legacy content bridge reads only localStorage.auth for our player and never exposes it to a webpage',()=>{
  const id='own-extension',player=`chrome-extension://${id}/player.html`;let handler,reads=0,reply;
  const window={};window.top=window;
  runInNewContext(readFileSync(new URL('../extension/auth-content.js',import.meta.url),'utf8'),{window,location:{origin:'https://www.yanhekt.cn'},
    localStorage:{getItem:key=>{reads++;assert.equal(key,'auth');return JSON.stringify({token:'c'.repeat(32)});}},
    chrome:{runtime:{id,getURL:name=>`chrome-extension://${id}/${name}`,onMessage:{addListener:fn=>{handler=fn;}}}}
  });
  handler({type:'READ_LEGACY_AUTH'},{id,url:'https://www.yanhekt.cn/course/52238'},value=>{reply=value;});assert.equal(reply,undefined);assert.equal(reads,0);
  handler({type:'READ_LEGACY_AUTH'},{id,url:player+'?legacy=52238'},value=>{reply=value;});assert.equal(reply.token,'c'.repeat(32));assert.equal(reads,1);
});
