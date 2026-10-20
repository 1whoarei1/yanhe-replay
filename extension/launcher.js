(() => {
  if (window.top !== window || document.getElementById('yanhe-replay-open')) return;
  const button = document.createElement('button');
  button.id = 'yanhe-replay-open'; button.type = 'button'; button.textContent = '用回放助手打开';
  button.title = '在独立播放器中查看回放与平台字幕';
  button.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_PLAYER' }));
  document.documentElement.append(button);
})();
