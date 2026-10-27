// Synthetic transport regression only; no campus accounts or lecture media.
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {launchTestBrowser} from './test-browser.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ext=resolve(process.env.EXTENSION_PATH||resolve(root,'extension'));
const profile=await mkdtemp(join(tmpdir(),'yanhe-live-test-')),output=resolve(root,'test-results');
await mkdir(output,{recursive:true});
const report={mode:'isolated Edge; mocked authorized/denied APIs; synthetic finite HLS/FLV for transport decoding',realLiveLatencyVerified:false,lectureVideoDownloaded:false,checks:[]};
let context;
try {
 context=await launchTestBrowser(profile,ext);
 report.browserVersion=context.browser()?.version();
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
 const id=new URL(worker.url()).host,requests=[];let revoked=false;
 await context.addCookies([{name:'_token',value:'eyJfixture.live.signature',domain:'aita.yanhekt.cn',path:'/',secure:true}]);
 const rows=[['11','直播测试','1'],['12','预告测试','2'],['13','结束测试','6'],['14','拒绝测试','1'],['15','备用测试','1'],['16','FLV测试','1']].map(([id,sub_title,sub_status])=>({id,sub_title,sub_status,type:'course_live',playback_status:'0',class_begin:id}));
 await context.route('https://**.yanhekt.cn/**',async route=>{
  const request=route.request(),u=new URL(request.url());requests.push({host:u.hostname,path:u.pathname,method:request.method()});
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(u.pathname.endsWith('infosimple'))return json({code:200,params:{id:7,tenant_id:21,phone:'13000000000',account:'fixture-account'}});
  if(u.pathname.endsWith('get-course-detail'))return json({code:0,data:{title:'本地直播回归',realname:'测试教师',sub_list:[...rows,{id:'90',sub_title:'回放测试',playback_status:'1',class_begin:'90'}]}});
  if(u.pathname.includes('/study-auth/')){
   assert.equal(request.headers().username,'fixture-account');assert.equal(request.headers()['tenant-id'],'21');
   return json({code:200,data:{hasPermission:!revoked&&!u.pathname.endsWith('/14')}});
  }
  if(u.pathname.endsWith('get-sub-info')){
   const sub=u.searchParams.get('sub_id');
   if(sub==='90')return json({code:0,data:{duration:5,video_list:{screen:{type:'2',status:'2',preview_url:'https://aita.yanhekt.cn/play/test.mp4'}}}});
   const mode=rows.find(r=>r.id===sub).sub_status;
   const output=sub==='16'?{flv:'https://clive14.yanhekt.cn/live/test.flv'}:{m3u8:`https://clive14.yanhekt.cn/live/${sub==='15'?'missing':'test'}.m3u8`};
   return json({code:0,data:{sub_type:'course_live',sub_status:mode,live_url:{output,...(sub==='15'?{output_ppt:{m3u8:'https://clive14.yanhekt.cn/live/test.m3u8'}}:{})}}});
  }
  if(u.pathname.endsWith('search-trans-result'))return json({code:0,list:[]});
  if(u.hostname==='clive14.yanhekt.cn'||u.pathname.startsWith('/play/')){
   if(revoked&&u.hostname==='clive14.yanhekt.cn')return route.fulfill({status:403,body:''});
   if(u.pathname.includes('missing'))return route.fulfill({status:404,body:''});
   const file=basename(u.pathname);assert.match(file,/^test(?:\.mp4|\.flv|\.m3u8|\d{3}\.ts)$/);
   return route.fulfill({contentType:file.endsWith('.m3u8')?'application/vnd.apple.mpegurl':file.endsWith('.flv')?'video/x-flv':file.endsWith('.ts')?'video/mp2t':'video/mp4',body:request.method()==='HEAD'?'':await readFile(join(root,'tests/fixtures',file))});
  }
  return route.fulfill({status:404,body:''});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await worker.evaluate(()=>chrome.storage.local.set({'progress:100:11':{time:90,view:'screen'},'subtitleOffset:100:11:classroom':{seconds:22}}));
 await page.goto(`chrome-extension://${id}/player.html?course=100&sub_id=11`);
 await page.getByRole('button',{name:'播放直播',exact:true}).waitFor({timeout:15000});
 assert.equal(await page.locator('.lecture-item').count(),6);
  assert.equal(await page.locator('.lecture-item').filter({hasText:'课程回放'}).count(),0);
 assert.equal(requests.filter(r=>r.host==='clive14.yanhekt.cn').length,0);
 report.checks.push('deep link selects live lesson; six live states have no replay filler label; no media before play');
 assert.equal(await page.locator('.transcript-pane').isVisible(),false);assert.equal(await page.locator('#speed').isDisabled(),true);
 await page.getByRole('button',{name:'播放直播',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video').currentTime>.2&&document.querySelector('video').videoWidth>0,undefined,{timeout:15000});
 assert.equal(await page.locator('#video').evaluate(v=>v.playbackRate),1);
 report.checks.push('synthetic HLS decodes in real Edge at 1x; live ignores stored replay progress and hides lyric controls');
 await page.getByRole('button',{name:'回到直播',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video').currentTime>3,undefined,{timeout:15000});
 report.checks.push('go-live control seeks to the available buffered edge');
 await page.screenshot({path:join(output,'live.png'),fullPage:true});
 const saved=await worker.evaluate(()=>chrome.storage.local.get('progress:100:11'));assert.equal(saved['progress:100:11'].time,90);
 report.checks.push('live playback never overwrites saved replay progress');
 await page.getByRole('button',{name:/预告测试/}).click();await page.getByRole('heading',{name:'直播尚未开始',exact:true}).waitFor();
 assert.equal(await page.locator('#play').isDisabled(),true);report.checks.push('upcoming lesson cannot play');
 await page.getByRole('button',{name:/结束测试/}).click();await page.getByRole('heading',{name:'直播已结束',exact:true}).waitFor();
 assert.equal(await page.locator('#play').isDisabled(),true);report.checks.push('ended lesson cannot masquerade as live');
 await page.getByRole('button',{name:/拒绝测试/}).click();await page.getByRole('button',{name:'播放直播',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video').currentTime>.2&&document.querySelector('video').videoWidth>0,undefined,{timeout:15000});
 report.checks.push('page permission false still permits a platform-provided stream that the media service serves successfully');
 await page.getByRole('button',{name:/备用测试/}).click();await page.getByRole('button',{name:'播放直播',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video').currentTime>.2&&document.querySelector('video').readyState>=2,undefined,{timeout:15000});
 assert.equal(await page.locator('#screen').getAttribute('aria-pressed'),'true');report.checks.push('404 main HLS falls back to a platform-provided PPT HLS stream');
 await page.getByRole('button',{name:/FLV测试/}).click();await page.getByRole('button',{name:'播放直播',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video').currentTime>.2&&document.querySelector('video').videoWidth>0,undefined,{timeout:15000});
 assert.ok(requests.some(r=>r.path.endsWith('.flv')&&r.method==='GET'));report.checks.push('bundled mpegts FLV transport decodes the synthetic H264 fixture');
 await page.getByRole('button',{name:'回放',exact:true}).click();await page.getByRole('button',{name:/回放测试/}).click();
 await page.getByRole('button',{name:'播放回放',exact:true}).waitFor();
 assert.equal(await page.locator('.transcript-pane').isVisible(),true);assert.equal(await page.locator('#go-live').isVisible(),false);report.checks.push('switching to replay restores transcript layout and hides go-live');
 await page.getByRole('button',{name:'直播',exact:true}).click();await page.getByRole('button',{name:/直播测试/}).click();
 await page.getByRole('button',{name:'播放直播',exact:true}).waitFor();revoked=true;
 const beforeRevoked=requests.filter(r=>r.host==='clive14.yanhekt.cn').length;
 await page.getByRole('button',{name:'播放直播',exact:true}).click();await page.locator('#playback-status').filter({hasText:'HTTP 403'}).waitFor();
 const revokedRequests=requests.filter(r=>r.host==='clive14.yanhekt.cn').slice(beforeRevoked);
 assert.ok(revokedRequests.some(r=>r.method==='HEAD'));assert.ok(revokedRequests.every(r=>r.method!=='GET'));
 assert.equal(await page.locator('#video').evaluate(v=>v.paused),true);report.checks.push('actual media HTTP 403 prevents playback and is not rewritten or mistaken for a page flag');
 assert.deepEqual(errors,[]);report.ok=true;
} catch(error) {
 report.ok=false;report.error=error.message;
 if(context?.pages()[0])await context.pages()[0].screenshot({path:join(output,'live-failed.png'),fullPage:true}).catch(()=>{});
 process.exitCode=1;
} finally {
 await writeFile(join(output,'live-browser-report.json'),JSON.stringify({...report,version:JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version},null,2));console.log(JSON.stringify({...report,version:JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version},null,2));
 await context?.close();if(dirname(resolve(profile))===resolve(tmpdir())&&basename(profile).startsWith('yanhe-live-test-'))await rm(profile,{recursive:true,force:true});
}
