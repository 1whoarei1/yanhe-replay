import { parseCourse, referrerRule } from './core.js';
import { legacyReferrerRule } from './legacy-core.js';

async function ensureRules() {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1,2], addRules: [referrerRule(chrome.runtime.id),legacyReferrerRule(chrome.runtime.id)] });
}
function playerUrl(value) {
  const url = new URL(chrome.runtime.getURL('player.html'));
  try {
    const ref = parseCourse(value);
    url.searchParams.set(ref.legacy ? 'legacy' : 'course', ref.id);
  } catch { /* A click from the home page opens a blank course input. */ }
  return url.href;
}
chrome.runtime.onInstalled.addListener(() => { ensureRules().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { ensureRules().catch(() => {}); });
chrome.action.onClicked.addListener(tab => { chrome.tabs.create({ url: playerUrl(tab.url || '') }); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'ENSURE_RULES' && sender.url?.startsWith(chrome.runtime.getURL('player.html'))) {
    ensureRules().then(() => respond({ ok: true }), () => respond({ ok: false })); return true;
  }
  if (message?.type === 'OPEN_PLAYER' && /^https:\/\/(aita|www)\.yanhekt\.cn\//.test(sender.url || '')) {
    chrome.tabs.create({ url: playerUrl(sender.url) }).then(() => respond({ ok: true })); return true;
  }
});
