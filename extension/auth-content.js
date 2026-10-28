(() => {
  if (window.top !== window || !['https://aita.yanhekt.cn','https://www.yanhekt.cn'].includes(location.origin)) return;
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    // Only our own player and download page may request the site's named login cookie. No page messages or DOM bridge.
    const pages = ['player.html','download.html'].map(name=>chrome.runtime.getURL(name));
    if (sender.id !== chrome.runtime.id || !pages.some(page=>sender.url===page||sender.url?.startsWith(page+'?'))) return;
    if(message?.type==='READ_LEGACY_AUTH' && location.origin==='https://www.yanhekt.cn') {
      let token=null;
      try { const auth=JSON.parse(localStorage.getItem('auth')||'{}');if(/^[a-f0-9]{32}$/i.test(auth.token||''))token=auth.token; }catch{}
      respond({token});return;
    }
    if(message?.type!=='READ_AUTH_COOKIE'||location.origin!=='https://aita.yanhekt.cn')return;
    const values = document.cookie.split(';').map(part => part.trim()).filter(part => part.startsWith('_token=')).map(part => part.slice('_token='.length));
    // The original course page also supports a login token on its own URL.
    const token = new URL(location.href).searchParams.get('token');
    if (token) values.push(token);
    respond({ values });
  });
})();
