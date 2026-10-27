import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {launchTestBrowser} from './test-browser.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const profile=await mkdtemp(join(tmpdir(),'yanhe-legacy-test-')),output=resolve(root,'test-results');await mkdir(output,{recursive:true});
const ext=resolve(process.env.EXTENSION_PATH||resolve(root,'extension')),token='d'.repeat(32),report={mode:'isolated Chromium; mocked old API; synthetic HLS; no lecture video saved',checks:[]};let context;
try{
  context=await launchTestBrowser(profile,ext);
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000}),id=new URL(worker.url()).host;const requests=[];
  await context.route('https://**.yanhekt.cn/**',async route=>{
    const request=route.request(),url=new URL(request.url());requests.push({host:url.hostname,path:url.pathname});
    const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({code:0,data})});
    if(url.hostname==='www.yanhekt.cn')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Legacy fixture</body></html>'});
    if(url.hostname==='cbiz.yanhekt.cn'){
      assert.equal(request.headers().authorization,`Bearer ${token}`);assert.equal(request.headers()['xdomain-client'],'web_user');
      if(url.pathname==='/v1/user')return json({id:7,badge:'fixture-badge'});
      if(url.pathname==='/v1/auth/video/token')return json({token:'video_fixture',now:100,expired_at:700});
      if(url.pathname==='/v1/live'){const session=url.searchParams.get('id')==='788580'?999999:920536;return json({id:Number(url.searchParams.get('id')),session_id:String(session),course:{id:71988,name_zh:'（英）纳米材料与物理'},session:{id:session,course_id:71988},status:url.searchParams.get('id')==='788580'?2:1,target:'https://cvideo.yanhekt.cn/play/test.m3u8',target_vga:'https://cvideo.yanhekt.cn/play/test.m3u8'});}
      if(url.pathname==='/v1/course/session')return json({id:Number(url.searchParams.get('session_id')),course_id:52238});
      if(url.pathname==='/v1/course')return json({id:Number(url.searchParams.get('id')),name_zh:url.searchParams.get('id')==='77464'?'数据结构与算法设计（C描述）':url.searchParams.get('id')==='71988'?'（英）纳米材料与物理':'模拟电子学A（Ⅱ）',professors:[{name:'测试教师'}],school_year:'2024-2025',semester:1});
      if(url.pathname==='/v2/course/session/list')return json(url.searchParams.get('course_id')==='77464'?[]:Array.from({length:16},(_,i)=>({id:url.searchParams.get('course_id')==='71988'&&i===0?920536:100+i,title:`第${i+1}节`,started_at:`2024-12-${String(i+1).padStart(2,'0')} 08:00:00`,videos:[{id:200+i,duration:'5',main:'https://cvideo.yanhekt.cn/play/test.m3u8',vga:'https://cvideo.yanhekt.cn/play/test.m3u8'}]})));
      if(url.pathname==='/v1/video/subtitle/list')return json([{language:'zh',url:'https://coss.yanhekt.cn/captions/test.vtt'}]);
    }
    if(url.hostname==='coss.yanhekt.cn')return route.fulfill({contentType:'text/vtt',body:'WEBVTT\n\n00:00:00.000 --> 00:00:02.900\n旧站测试字幕\n\n00:00:03.000 --> 00:00:05.000\n第二句\n'});
    if(url.hostname==='cvideo.yanhekt.cn'){
      assert.equal(url.searchParams.get('Xvideo_Token'),'video_fixture');assert.equal(url.searchParams.has('t'),false);assert.match(url.pathname,/^\/play\/[a-f0-9]{32}\/test/);
      const file=basename(url.pathname);assert.match(file,/^test(?:\.m3u8|\d{3}\.ts)$/);
      return route.fulfill({status:200,contentType:file.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t',body:await readFile(join(root,'tests','fixtures',file))});
    }
    return route.fulfill({status:404,body:''});
  });
  const original=await context.newPage();await original.goto('https://www.yanhekt.cn/course/52238');
  await original.evaluate(value=>localStorage.setItem('auth',JSON.stringify({token:value,login:true})),token);await original.locator('#yanhe-replay-open').waitFor();
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`chrome-extension://${id}/player.html?legacy=52238`);
  await page.getByRole('heading',{name:'模拟电子学A（Ⅱ）',exact:true}).waitFor();assert.equal(await page.locator('.lecture-item').count(),16);assert.equal(await page.locator('#platform').inputValue(),'legacy');report.checks.push('old URL reads old localStorage login and sixteen sessions; never calls new course API');
  await page.locator('.lecture-item').first().click();await page.locator('.subtitle-item').first().waitFor();assert.equal(await page.locator('.subtitle-item').count(),2);
  assert.ok(!requests.some(row=>row.host==='cvideo.yanhekt.cn'));report.checks.push('old platform VTT displayed without ASR or preloading video');
  await page.getByRole('button',{name:'播放回放',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video').currentTime>.25&&document.querySelector('video').videoWidth>0,null,{timeout:15000});
  assert.equal(await page.getByRole('button',{name:'主画面',exact:true}).getAttribute('aria-pressed'),'true');report.checks.push('legacy signed HLS playlist and segments decode in Chromium');
  await page.locator('#subtitle-calibration summary').click();await page.locator('#subtitle-offset').fill('0.5');await page.getByRole('button',{name:'应用',exact:true}).click();
  await page.waitForFunction(async()=>Boolean((await chrome.storage.local.get('subtitleOffset:legacy:52238:100:200:classroom'))['subtitleOffset:legacy:52238:100:200:classroom']));report.checks.push('old calibration saved in a separate platform namespace');
  await page.screenshot({path:join(output,'legacy-mock.png'),fullPage:true});
  await page.locator('#platform').selectOption('legacy');await page.locator('#course-input').fill('https://www.yanhekt.cn/live/788579');await page.getByRole('button',{name:'读取课程',exact:true}).click();
  await page.getByRole('heading',{name:'（英）纳米材料与物理',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.lecture-item.selected')?.dataset.id==='live:788579');
  assert.equal(await page.locator('#platform').inputValue(),'legacy');assert.match(await page.locator('#course-meta').innerText(),/71988/);
  assert.ok(!requests.some(row=>row.path.startsWith('/courseapi/')));report.checks.push('pasted old live URL resolves its course and preserves live:788579 instead of selecting a recording');
  await page.locator('#course-input').fill('https://www.yanhekt.cn/session/100');await page.getByRole('button',{name:'读取课程',exact:true}).click();
  await page.getByRole('heading',{name:'模拟电子学A（Ⅱ）',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.lecture-item.selected')?.dataset.id==='100:200');report.checks.push('pasted old replay link resolves its course and selects the corresponding recording');
  await original.evaluate(()=>history.pushState({},'','/live/788579'));
  const [launched]=await Promise.all([context.waitForEvent('page'),original.locator('#yanhe-replay-open').click()]);
  await launched.getByRole('heading',{name:'（英）纳米材料与物理',exact:true}).waitFor();
  await launched.waitForFunction(()=>document.querySelector('.lecture-item.selected')?.dataset.id==='live:788579');
  assert.equal(new URL(launched.url()).searchParams.get('legacy_live'),'788579');
  assert.equal(await launched.locator('#platform').inputValue(),'legacy');report.checks.push('actual bottom-right launcher after SPA navigation opens the current old live course instead of a blank player');
  await launched.screenshot({path:join(output,'legacy-live-launcher.png'),fullPage:true});await launched.close();
  await page.locator('#course-input').fill('https://www.yanhekt.cn/live/788579');await page.getByRole('button',{name:'读取课程',exact:true}).click();
  await page.getByRole('heading',{name:'（英）纳米材料与物理',exact:true}).waitFor();
  await original.evaluate(()=>history.pushState({},'','/course/77464'));
  const [emptyPage]=await Promise.all([context.waitForEvent('page'),original.locator('#yanhe-replay-open').click()]);
  await emptyPage.getByRole('heading',{name:'数据结构与算法设计（C描述）',exact:true}).waitFor();
  assert.equal(await emptyPage.locator('.lecture-item').count(),0);report.checks.push('bottom-right launcher on an old course page preserves that course after SPA navigation');await emptyPage.close();
  await page.locator('#course-input').fill('https://www.yanhekt.cn/live/788580');await page.getByRole('button',{name:'读取课程',exact:true}).click();
  await page.getByRole('heading',{name:'直播尚未开始',exact:true}).waitFor();assert.equal(await page.locator('.lecture-item').count(),1);assert.equal(await page.locator('#play').isDisabled(),true);report.checks.push('an upcoming old live lesson stays unavailable and never switches to an unrelated replay');
  await page.locator('#course-input').fill('https://www.yanhekt.cn/course/77464');await page.getByRole('button',{name:'读取课程',exact:true}).click();await page.getByRole('heading',{name:'数据结构与算法设计（C描述）',exact:true}).waitFor();
  assert.equal(await page.locator('.lecture-item').count(),0);assert.equal(await page.locator('#replay-count').innerText(),'0 次');report.checks.push('valid old course with zero sessions is represented honestly');
  await page.locator('#platform').selectOption('modern');await page.locator('#course-input').fill('110118');await page.getByRole('button',{name:'读取课程',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('未读到'));report.checks.push('old opaque login is never mistaken for a new-platform login');
  const stored=JSON.stringify(await page.evaluate(()=>chrome.storage.local.get(null)));assert.ok(!stored.includes(token)&&!stored.includes('video_fixture'));
  assert.ok(!requests.some(row=>row.path.startsWith('/courseapi/')));assert.deepEqual(errors,[]);report.ok=true;
}catch(error){report.ok=false;report.error=String(error.message).replace(/https?:\/\/\S+/g,'[url]');report.location=error.stack?.split('\n').find(line=>line.includes('legacy-browser-test'));process.exitCode=1;}
finally{if(context)await context.close();if(dirname(profile)===resolve(tmpdir())&&basename(profile).startsWith('yanhe-legacy-test-'))await rm(profile,{recursive:true,force:true});await writeFile(join(output,'legacy-browser-report.json'),JSON.stringify({...report,version:JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version},null,2));console.log(JSON.stringify({...report,version:JSON.parse(await readFile(join(ext,'manifest.json'),'utf8')).version},null,2));}
