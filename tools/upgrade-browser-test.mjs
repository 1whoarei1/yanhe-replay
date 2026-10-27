import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {launchTestBrowser} from './test-browser.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),ext=resolve(process.env.EXTENSION_PATH||join(root,'extension')),out=join(root,'test-results');
const profile=await mkdtemp(join(tmpdir(),'yanhe-upgrade-test-')),report={version:JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version,mode:'isolated browser; synthetic APIs and media; no real campus requests',checks:[]};await mkdir(out,{recursive:true});let context,page;
try{
 context=await launchTestBrowser(profile,ext);const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const token='upgrade-fixture-token',cookie=`a:2:{i:0;s:6:"_token";i:1;s:${token.length}:"${token}";}`;await context.addCookies([{name:'_token',value:encodeURIComponent(cookie),domain:'aita.yanhekt.cn',path:'/',secure:true,sameSite:'None'}]);
 const requests=[],media=[],errors=[];let brokenRoom=false;
 const course=id=>({id:Number(id),title:String(id)==='101'?'强化学习':'计算机视觉',realname:'示例教师',term_name:'2026-2027-1',kkxy_name:'示例学院'});
 await context.route('https://**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;requests.push({path,query:Object.fromEntries(u.searchParams),method:req.method()});assert.ok(['GET','HEAD'].includes(req.method()));
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  if(path==='/userapi/v1/infosimple')return json({code:200,params:{id:7,tenant_id:21,phone:'13000000000',account:'fixture'}});
  if(path.endsWith('/term-list'))return json({code:1000,params:{list:[{id:1,term_name:'2026-2027-1'}]}});
  if(path.endsWith('/structures'))return json({code:1000,params:{data:[{id:9,display_name:'学校',child:[{id:2,display_name:'示例学院'}]}]}});
  if(path.endsWith('/get-course-list')){
   assert.equal(req.headers()['tenant-id'],'21');const q=u.searchParams.get('title');if(q==='慢')await new Promise(r=>setTimeout(r,600));
   const rows=q==='空'?[]:q==='恶意'?[{...course(102),title:'<img src=x onerror="window.injected=true">'}]:[course(q==='快'||u.searchParams.get('page')==='2'?101:100)];
   return json({code:0,data:{total:q?rows.length:81,list:rows}});
  }
  if(path.endsWith('/get-course-detail'))return json({code:0,data:{...course(u.searchParams.get('course_id')),sub_list:[{id:200,sub_title:'第一讲',playback_status:'1',class_begin:1},{id:201,sub_title:'第二讲',playback_status:'1',class_begin:2}]}});
  if(path.endsWith('/get-sub-info'))return json({code:0,data:{duration:120,video_list:{screen:{type:2,status:2,preview_url:'https://aita.yanhekt.cn/play/timing.mp4'},room:{type:3,status:2,preview_url:'https://aita.yanhekt.cn/play/timing-room.mp4'}}}});
  if(path.endsWith('/search-trans-result'))return json({code:0,list:[{all_content:[{BeginSec:0,EndSec:60,Text:'第一句字幕'},{BeginSec:60,EndSec:120,Text:'第二句字幕'}]}]});
  if(path.startsWith('/play/')){media.push({path,method:req.method()});if(brokenRoom&&path.endsWith('timing-room.mp4'))return route.fulfill({status:404,body:''});const data=await readFile(join(root,'tests/fixtures',basename(path))),range=req.headers().range?.match(/^bytes=(\d+)-(\d*)$/),headers={'Accept-Ranges':'bytes'};if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;return route.fulfill({status:206,contentType:'video/mp4',headers,body:data.subarray(start,end+1)});}return route.fulfill({contentType:'video/mp4',headers,body:data});}
  throw Error('Unexpected synthetic request '+path);
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(`chrome-extension://${id}/player.html`);
 await page.getByRole('button',{name:'全校课程',exact:true}).click();await page.locator('.catalog-row').waitFor();await page.locator('#catalog-college:not([disabled])').waitFor();assert.equal(media.length,0);
 await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByRole('button',{name:'打开 强化学习 示例教师',exact:true}).waitFor();assert.equal(await page.locator('#catalog-page').innerText(),'2 / 3');
 await page.getByRole('button',{name:'上一页',exact:true}).click();await page.getByRole('button',{name:'打开 计算机视觉 示例教师',exact:true}).waitFor();
 await page.getByLabel('学期',{exact:true}).selectOption('1');await page.locator('#catalog-results[aria-busy=false]').waitFor();await page.getByLabel('学院',{exact:true}).selectOption('2');await page.locator('#catalog-results[aria-busy=false]').waitFor();assert.ok(requests.some(r=>r.query.term==='1'&&r.query['struc_ids[]']==='2'));
 report.checks.push('school course index supports paging, teacher/name queries, nested college and term filters; browsing requests no media');
 await page.locator('#catalog-query').fill('慢');await page.locator('#catalog-query').press('Enter');await page.locator('#catalog-query').fill('快');await page.locator('#catalog-query').press('Enter');await page.getByRole('button',{name:'打开 强化学习 示例教师',exact:true}).waitFor();await page.waitForTimeout(700);assert.equal(await page.locator('.catalog-row').innerText(),await page.getByRole('button',{name:'打开 强化学习 示例教师',exact:true}).innerText());
 await page.locator('#catalog-query').fill('恶意');await page.locator('#catalog-query').press('Enter');await page.getByRole('button',{name:'打开 <img src=x onerror="window.injected=true"> 示例教师',exact:true}).waitFor();await page.locator('#catalog-results[aria-busy=false]').waitFor();assert.equal(await page.locator('.catalog-row img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
 await page.locator('#catalog-query').fill('空');await page.locator('#catalog-query').press('Enter');await page.getByText('未找到课程',{exact:true}).waitFor();
 await page.locator('#catalog-query').fill('100');await page.locator('#catalog-query').press('Enter');await page.getByRole('button',{name:'打开 计算机视觉 示例教师',exact:true}).click();await page.getByRole('heading',{name:'计算机视觉',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('course'),'100');assert.equal(media.length,0);
 report.checks.push('stale search responses, empty results and HTML-like course names stay safe; ID selection opens the exact modern course');
 await page.locator('.lecture-item').first().click();await page.locator('#dual:not([disabled])').waitFor();await page.getByRole('button',{name:'双画面',exact:true}).click();assert.equal(media.length,0);
 await page.evaluate(()=>{window.mediaEvents=[];for(const id of ['video','secondary-video'])for(const event of ['play','playing','pause','seeking','seeked','error','loadedmetadata'])document.getElementById(id).addEventListener(event,()=>window.mediaEvents.push({id,event,time:document.getElementById(id).currentTime,paused:document.getElementById(id).paused,muted:document.getElementById(id).muted}));});
 await page.getByRole('button',{name:'播放回放',exact:true}).click();await page.waitForFunction(()=>['video','secondary-video'].every(id=>{const v=document.getElementById(id);return v.videoWidth>0&&v.currentTime>.2;}));
 await page.locator('#video').evaluate(v=>{v.pause();v.currentTime=11;});await page.waitForFunction(()=>document.getElementById('secondary-video').paused&&Math.abs(document.getElementById('secondary-video').currentTime-11)<.8);
 await page.locator('#speed').selectOption('1.5');await page.waitForFunction(()=>document.getElementById('secondary-video').playbackRate===1.5);
 await page.getByLabel('声音来源').selectOption('classroom');assert.deepEqual(await page.evaluate(()=>[document.getElementById('video').muted,document.getElementById('secondary-video').muted]),[true,false]);
 await page.getByLabel('声音来源').selectOption('muted');assert.deepEqual(await page.evaluate(()=>[document.getElementById('video').muted,document.getElementById('secondary-video').muted]),[true,true]);
 await page.setViewportSize({width:1920,height:1100});await page.screenshot({path:join(out,'replay-dual.png'),fullPage:true});
 report.checks.push('dual playback synchronizes pause, seek and speed while selecting exactly one audio source');
 await page.getByRole('button',{name:'课次',exact:true}).click();await page.getByRole('button',{name:'字幕',exact:true}).click();assert.equal(await page.locator('.lecture-pane').isVisible(),false);assert.equal(await page.locator('.transcript-pane').isVisible(),false);
 for(const width of [3840,2560,1920,1024,768,375]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);}
 await page.getByRole('button',{name:'课次',exact:true}).click();await page.getByRole('button',{name:'字幕',exact:true}).click();await page.getByRole('button',{name:'双画面',exact:true}).click();assert.equal(await page.locator('#secondary-video').getAttribute('src'),null);
 report.checks.push('pane collapse and dual layout fit 375–3840 px; leaving dual mode releases the secondary media');
 const count=()=>requests.filter(r=>r.path.endsWith('/get-course-detail')).length,before=count();await page.reload();await page.locator('.lecture-item.selected').waitFor();assert.equal(count(),before);await page.locator('#refresh-list').click();await page.waitForFunction(()=>!document.getElementById('load-course').disabled);assert.equal(count(),before+1);
 report.checks.push('reload reuses the replay list and lesson; explicit refresh makes a fresh metadata request');
 await page.locator('#play:not([disabled])').waitFor();await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('video').videoWidth>0);brokenRoom=true;await page.locator('#dual').click();await page.getByText(/保留单画面/).waitFor();assert.equal(await page.locator('#secondary-stage').isVisible(),false);assert.ok(await page.locator('#video').evaluate(v=>v.videoWidth>0));
 report.checks.push('a failed secondary source keeps the primary video available');
 await page.getByRole('button',{name:'全校课程',exact:true}).click();await page.locator('#catalog-query').fill('');await page.getByLabel('学期',{exact:true}).selectOption('');await page.locator('#catalog-results[aria-busy=false]').waitFor();await page.getByLabel('学院',{exact:true}).selectOption('');await page.locator('#catalog-results[aria-busy=false]').waitFor();await page.locator('#catalog-query').press('Enter');await page.locator('.catalog-row').waitFor();await page.screenshot({path:join(out,'replay-school-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:join(out,'replay-school.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.ok(!JSON.stringify(await page.evaluate(()=>chrome.storage.local.get(null))).includes(token));report.ok=true;
}catch(error){report.ok=false;report.error=error.stack;report.mediaState=await page?.evaluate(()=>({events:window.mediaEvents,videos:Array.from(document.querySelectorAll('video')).map(v=>({id:v.id,time:v.currentTime,paused:v.paused,readyState:v.readyState,error:v.error?.code})),status:document.getElementById('playback-status').textContent})).catch(()=>null);process.exitCode=1;await page?.screenshot({path:join(out,'replay-upgrade-failed.png'),fullPage:true}).catch(()=>{});}
finally{await context?.close();if(dirname(resolve(profile))===resolve(tmpdir())&&basename(profile).startsWith('yanhe-upgrade-test-'))await rm(profile,{recursive:true,force:true});await writeFile(join(out,'upgrade-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
