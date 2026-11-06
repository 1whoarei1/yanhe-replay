import { parseCourse, referrerRule } from './core.js';
import { legacyReferrerRule } from './legacy-core.js';
import {AutoSlidesIndex} from './autoslides-index.js';
import {liveCourseCandidates} from './live-links.js';
import {readImportedCatalog} from './catalog-import.js';

const catalog=new AutoSlidesIndex({local:true});
async function publicCatalog({method,values=[]}={}){
  if(!Array.isArray(values)||values.length>2)throw new Error('目录读取条件无效');
  if(method==='liveCandidates'){
    const [course,platform]=values;
    if(!course||typeof course!=='object'||JSON.stringify(course).length>4096)throw new Error('课程信息无效');
    return liveCourseCandidates(course,platform,{readCatalog:readImportedCatalog});
  }
  if(!['terms','search','course','owner','sessions'].includes(method))throw new Error('不支持的目录读取');
  if(['course','owner','sessions'].includes(method)&&!/^\d{1,12}$/.test(String(values[0])))throw new Error('编号无效');
  return catalog[method](...values);
}

async function ensureRules() {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1,2], addRules: [referrerRule(chrome.runtime.id),legacyReferrerRule(chrome.runtime.id)] });
}
function playerUrl(value) {
  const url = new URL(chrome.runtime.getURL('player.html'));
  try {
    const ref = parseCourse(value);
    if (ref.liveId) url.searchParams.set('legacy_live',ref.liveId);
    else if (ref.sessionId) url.searchParams.set('legacy_session',ref.sessionId);
    else url.searchParams.set(ref.legacy ? 'legacy' : 'course', ref.id);
    if (ref.subId) url.searchParams.set('sub_id', ref.subId);
  } catch {
    // Retain the actual source instead of silently restoring an unrelated last course.
    try {
      const source=new URL(value);
      if(source.protocol==='https:'&&['aita.yanhekt.cn','www.yanhekt.cn'].includes(source.hostname)&&!source.username&&!source.password&&!source.port){
        source.search='';source.hash='';url.searchParams.set('source',source.href);
      }
    } catch {}
  }
  return url.href;
}
chrome.runtime.onInstalled.addListener(() => { ensureRules().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { ensureRules().catch(() => {}); });
chrome.action.onClicked.addListener(tab => { chrome.tabs.create({ url: playerUrl(tab.url || '') }); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if(message?.type==='REFINE_READ'&&message.operation==='publicCatalog'&&['player.html','download.html'].some(path=>sender.url===chrome.runtime.getURL(path)||sender.url?.startsWith(chrome.runtime.getURL(path)+'?'))){
    publicCatalog(message.args).then(value=>respond({ok:true,value}),error=>respond({ok:false,error:error.message}));return true;
  }
  if (message?.type === 'ENSURE_RULES' && ['player.html','download.html'].some(path=>sender.url?.startsWith(chrome.runtime.getURL(path)))) {
    ensureRules().then(() => respond({ ok: true }), () => respond({ ok: false })); return true;
  }
  if (message?.type === 'OPEN_PLAYER' && /^https:\/\/(aita|www)\.yanhekt\.cn\//.test(sender.url || '')) {
    let source=sender.tab?.url||sender.url;
    try {const actual=new URL(message.url);if(actual.origin===new URL(sender.url).origin&&!actual.username&&!actual.password&&!actual.port)source=actual.href;}catch{}
    chrome.tabs.create({ url: playerUrl(source) }).then(() => respond({ ok: true }),()=>respond({ok:false})); return true;
  }
});
