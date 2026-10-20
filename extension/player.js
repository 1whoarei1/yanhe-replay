import { YanheApi } from './api.js';
import { LegacyYanheApi } from './legacy-api.js';
import { parseCourse, clock, vtt, explain, subtitleOffset, shiftSubtitles, subtitleClock } from './core.js';

const $ = id => document.getElementById(id);
const video = $('video');
let api = new YanheApi();
const state = { course: null, selected: null, info: null, view: 'screen', subtitles: [], controller: null,
  sequence: 0, mediaEpoch: 0, hls: null, attached: false, connecting: false, restoring: false,
  resume: 0, lastSigned: 0, lastRecovery: 0, lastSaved: 0, activeCue: -1, vttUrl: null, courseLoading: false,
  blockedViews: new Set(), sourceNote: '', followLyrics: true, lyricFrame: 0,
  rawSubtitles: [], offsets: { screen: 0, classroom: 0 }, calibrating: false, offsetSave: Promise.resolve() };

function message(text, kind = '') { $('message').textContent = text; $('message').className = `notice ${kind}`; }
function playbackStatus(text, error = false) { $('playback-status').textContent = text; $('playback-status').className = `playback-status${error ? ' error' : ''}`; }
const storage = {
  async get(key) { try { return (await chrome.storage.local.get(key))[key]; } catch { return null; } },
  async set(values) { try { await chrome.storage.local.set(values); return true; } catch { return false; } }
};
function courseKey() { return `${state.course?.legacy ? 'legacy:' : ''}${state.course?.id}`; }
function progressKey() { return state.course && state.selected ? `progress:${courseKey()}:${state.selected.id}` : null; }
function offsetKey(view = state.view) { return state.course && state.selected ? `subtitleOffset:${courseKey()}:${state.selected.id}:${view}` : null; }
function viewName(view) { return view === 'screen' ? '屏幕画面' : state.course?.legacy ? '主画面' : '教室画面'; }
function savedOffset(value) { try { return subtitleOffset(value?.seconds ?? 0); } catch { return 0; } }
function saveProgress(force = false) {
  const key = progressKey();
  if (!key || !state.attached || state.connecting || state.restoring || !Number.isFinite(video.currentTime) || (!force && Date.now() - state.lastSaved < 7000)) return;
  state.lastSaved = Date.now();
  void storage.set({ [key]: { time: video.currentTime, view: state.view, updatedAt: Date.now() } });
}
function clearMedia() {
  state.mediaEpoch++; state.connecting = false; state.restoring = false;
  if (state.hls) { state.hls.destroy(); state.hls = null; }
  video.pause(); video.removeAttribute('src'); video.load(); state.attached = false;
  clearCaptionTracks();
}
function clearCaptionTracks() {
  // Detached tracks can briefly remain in video.textTracks in Chromium. Silence them first.
  for (const track of video.textTracks) track.mode = 'disabled';
  video.querySelectorAll('track').forEach(track => track.remove());
  if (state.vttUrl) { URL.revokeObjectURL(state.vttUrl); state.vttUrl = null; }
}
function resetSelection() {
  saveProgress(true); state.controller?.abort(); clearMedia(); state.selected = null; state.info = null; state.subtitles = []; state.rawSubtitles = [];
  state.offsets = { screen: 0, classroom: 0 }; state.calibrating = false;
  state.blockedViews.clear(); state.sourceNote = '';
  $('stage-empty').classList.remove('hidden'); $('stage-label').textContent = '选择课次';
  $('stage-detail').textContent = '';
  $('play').disabled = true; $('retry').disabled = true;
  $('lecture-title').textContent = '尚未选择课次'; $('duration').textContent = '';
  for (const view of ['screen','classroom']) { $(view).disabled = true; $(view).setAttribute('aria-pressed','false'); }
  $('subtitle-search').value = ''; $('subtitle-search').disabled = true; $('subtitle-count').textContent = '—';
  cancelAnimationFrame(state.lyricFrame); state.lyricFrame = 0; state.followLyrics = true; state.activeCue = -1;
  $('show-captions').disabled = true; $('return-sync').hidden = true;
  $('subtitle-mode').textContent = '随播放滚动'; $('subtitle-list').classList.remove('searching');
  $('subtitle-time').textContent = '0:00'; $('current-caption').textContent = '';
  $('subtitle-list').replaceChildren();
  updateCalibration(); $('calibration-status').textContent = '';
}
function textNode(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
function renderLectures() {
  const list = $('lecture-list'); list.replaceChildren();
  $('replay-count').textContent = `${state.course.replays.length} 次`;
  if (!state.course.replays.length) { list.append(textNode('p','暂无回放','empty')); return; }
  for (const lecture of state.course.replays) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'lecture-item'; button.dataset.id = lecture.id;
    const match = lecture.title.match(/^(\d{4})-(\d+)-(\d+)(.+)$/);
    button.append(textNode('strong',match ? `${Number(match[2])}月${Number(match[3])}日` : lecture.title), textNode('span',match ? `${match[1]}年 ${match[4]}` : '课程回放'));
    button.addEventListener('click',() => selectLecture(lecture)); list.append(button);
  }
}
function cuePosition(time) {
  let low = 0, high = state.subtitles.length - 1, index = -1;
  while (low <= high) { const mid = (low + high) >> 1; if (state.subtitles[mid].start <= time) { index = mid; low = mid + 1; } else high = mid - 1; }
  const anchor = Math.max(0,index);
  if (index >= 0 && time >= state.subtitles[index].end) index = -1;
  return { index, anchor };
}
function updateLyricMode() {
  const searching = Boolean($('subtitle-search').value.trim());
  $('subtitle-mode').textContent = searching ? `搜索结果 ${$('subtitle-list').querySelectorAll('.subtitle-item').length} 段` : state.followLyrics ? '随播放滚动' : '正在浏览字幕';
  $('return-sync').hidden = !state.subtitles.length || (!searching && state.followLyrics);
}
function centerLyric(smooth = true) {
  if (!state.followLyrics || $('subtitle-search').value.trim()) return;
  const list = $('subtitle-list');
  const { anchor } = cuePosition(state.attached ? video.currentTime : state.resume);
  const row = list.querySelector(`[data-index="${anchor}"]`);
  if (!row || !list.clientHeight) return;
  const top = Math.max(0,Math.min(list.scrollHeight - list.clientHeight,row.offsetTop + row.offsetHeight / 2 - list.clientHeight / 2));
  if (Math.abs(top - list.scrollTop) < 2) return;
  list.scrollTo({ top, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
}
function scheduleLyricCenter(smooth = true) {
  cancelAnimationFrame(state.lyricFrame);
  state.lyricFrame = requestAnimationFrame(() => { state.lyricFrame = 0; centerLyric(smooth); });
}
function browseLyrics() {
  if (!state.subtitles.length || !state.followLyrics) return;
  state.followLyrics = false; cancelAnimationFrame(state.lyricFrame); state.lyricFrame = 0;
  // Stop a pending smooth scroll before the user's wheel or scrollbar takes over.
  $('subtitle-list').scrollTo({ top: $('subtitle-list').scrollTop, behavior: 'instant' });
  updateLyricMode();
}
function followCurrentLyric() {
  const searching = Boolean($('subtitle-search').value);
  $('subtitle-search').value = ''; state.followLyrics = true;
  if (searching) renderSubtitles();
  updateLyricMode(); scheduleLyricCenter();
}
function seekSubtitle(row,index) {
  if (state.calibrating) { alignSubtitle(index); return; }
  state.resume = Math.max(0,row.start);
  if (state.attached) video.currentTime = state.resume;
  else void connectPlayback(state.resume);
  followCurrentLyric(); updateActiveCue();
}
function updateCalibration() {
  const offset = state.offsets[state.view] || 0;
  $('subtitle-offset').value = String(offset);
  $('offset-summary').textContent = offset === 0 ? '未偏移' : `${offset > 0 ? '延后' : '提前'} ${Math.abs(offset)} 秒`;
  $('offset-controls').disabled = !state.rawSubtitles.length;
  $('align-current').disabled = !state.rawSubtitles.length || !state.attached;
  $('align-current').setAttribute('aria-pressed',String(state.calibrating));
  $('cancel-align').hidden = !state.calibrating;
  $('subtitle-list').classList.toggle('calibrating',state.calibrating);
}
function applyTimeline() {
  const list = $('subtitle-list'), previousTop = list.scrollTop;
  state.subtitles = shiftSubtitles(state.rawSubtitles,state.offsets[state.view]);
  renderSubtitles();
  if (!state.followLyrics || $('subtitle-search').value.trim()) list.scrollTo({top:previousTop,behavior:'instant'});
  if (state.attached) attachCaptions();
  updateCalibration();
}
function setSubtitleOffset(value) {
  const key = offsetKey(); if (!key || !state.rawSubtitles.length) return;
  let offset;
  try { offset = subtitleOffset(value); }
  catch (error) { $('calibration-status').textContent = explain(error); return; }
  state.offsets[state.view] = offset; state.calibrating = false; applyTimeline();
  $('calibration-status').textContent = '';
  // Serialize quick nudges so the last value always wins, including after switching views.
  state.offsetSave = state.offsetSave.then(() => storage.set({[key]:{seconds:offset,updatedAt:Date.now()}})).then(ok => {
    if (offsetKey() === key && state.offsets[state.view] === offset) $('calibration-status').textContent = ok ? '已保存' : '偏移已应用，保存失败';
  });
}
function alignSubtitle(index) {
  if (!state.attached || !state.rawSubtitles[index]) return;
  setSubtitleOffset(video.currentTime - state.rawSubtitles[index].start);
  followCurrentLyric(); updateActiveCue();
}
function renderSubtitles() {
  const search = $('subtitle-search').value.trim().toLocaleLowerCase();
  const fragment = document.createDocumentFragment(); let visible = 0;
  for (let index = 0; index < state.subtitles.length; index++) {
    const row = state.subtitles[index];
    if (search && !row.text.toLocaleLowerCase().includes(search)) continue;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'subtitle-item'; button.dataset.index = String(index); button.dataset.start = String(row.start);
    const original = state.rawSubtitles[index] || row;
    button.title = `原始 ${subtitleClock(original.start)} · 播放时间 ${subtitleClock(row.start)}；点击${state.calibrating ? '对齐当前播放时间' : '跳转'}`;
    button.append(textNode('time',subtitleClock(row.start)),textNode('span',row.text));
    button.addEventListener('click',() => seekSubtitle(row,index));
    fragment.append(button); visible++;
  }
  if (!visible) fragment.append(textNode('p', search ? '没有找到匹配字幕。' : '暂无字幕','empty'));
  const list = $('subtitle-list'); list.classList.toggle('searching',Boolean(search)); list.replaceChildren(fragment); list.scrollTop = 0;
  state.activeCue = -1; updateActiveCue(false); updateLyricMode(); scheduleLyricCenter(false);
}
function updateActiveCue(center = true) {
  const time = state.attached ? video.currentTime : state.resume;
  const { index } = cuePosition(time);
  $('subtitle-time').textContent = clock(time);
  $('current-caption').textContent = state.subtitles.length && state.attached && index < 0 ? '此处无字幕' : '';
  if (state.activeCue === index) return;
  const previous = $('subtitle-list').querySelector('.active'); previous?.classList.remove('active'); previous?.removeAttribute('aria-current');
  const current = $('subtitle-list').querySelector(`[data-index="${index}"]`); current?.classList.add('active'); current?.setAttribute('aria-current','true'); state.activeCue = index;
  if (center) scheduleLyricCenter();
}
function attachCaptions() {
  clearCaptionTracks();
  if (!state.subtitles.length) return;
  state.vttUrl = URL.createObjectURL(new Blob([vtt(state.subtitles)],{type:'text/vtt'}));
  const track = document.createElement('track'); track.kind = 'subtitles'; track.label = '平台字幕'; track.srclang = 'zh'; track.src = state.vttUrl;
  track.default = $('show-captions').checked; video.append(track); track.track.mode = $('show-captions').checked ? 'showing' : 'disabled';
}
function updateViews() {
  for (const view of ['screen','classroom']) {
    $(view).disabled = !state.info?.streams[view] || state.blockedViews.has(view);
    $(view).textContent = `${viewName(view)}${state.blockedViews.has(view) ? '（源失效）' : ''}`;
    $(view).setAttribute('aria-pressed',String(state.view === view));
  }
}

async function loadCourse() {
  if (state.courseLoading) return;
  let ref;
  try { ref = parseCourse($('course-input').value); if (/^\d+$/.test($('course-input').value.trim())) ref.legacy = $('platform').value === 'legacy'; }
  catch (error) { message(explain(error),'error'); return; }
  resetSelection(); const sequence = ++state.sequence; state.controller = new AbortController(); state.courseLoading = true;
  api.reset(); api = ref.legacy ? new LegacyYanheApi() : new YanheApi();
  $('platform').value = ref.legacy ? 'legacy' : 'modern';
  $('site-link').href = ref.legacy ? 'https://www.yanhekt.cn/' : 'https://aita.yanhekt.cn/';
  $('load-course').disabled = true; $('load-course').textContent = '正在读取…'; message('');
  state.course = null; $('lecture-list').replaceChildren(textNode('p','正在读取课程…','empty'));
  try {
    const rules = await chrome.runtime.sendMessage({ type: 'ENSURE_RULES' });
    if (!rules?.ok) throw new Error('插件的播放请求配置未准备好。请在扩展管理页面重新加载本插件。');
    const course = await api.course(ref.id,state.controller.signal);
    if (sequence !== state.sequence) return;
    state.course = course; $('course-title').textContent = course.title;
    $('course-meta').textContent = [course.teacher,course.term,`课程 ID ${course.id}`].filter(Boolean).join(' / ');
    $('connection').textContent = '已连接延河课堂'; $('connection').classList.add('online');
    message(''); renderLectures();
    $('subtitle-list').append(textNode('p','暂无字幕','empty'));
    playbackStatus('等待选择课次'); await storage.set({ lastCourse: course.id, lastPlatform: ref.legacy ? 'legacy' : 'modern' });
  } catch (error) {
    if (sequence !== state.sequence) return;
    message(explain(error),'error'); $('connection').textContent = '尚未连接'; $('connection').classList.remove('online');
    $('course-title').textContent = '暂时无法读取课程'; $('course-meta').textContent = '';
    $('replay-count').textContent = '—'; $('lecture-list').replaceChildren(textNode('p','未连接','empty'));
  } finally { if (sequence === state.sequence) { state.courseLoading = false; $('load-course').disabled = false; $('load-course').textContent = '读取课程'; } }
}

async function selectLecture(lecture) {
  if (!state.course) return;
  resetSelection(); const sequence = ++state.sequence; state.controller = new AbortController(); const signal = state.controller.signal;
  state.selected = lecture; state.resume = 0; state.lastRecovery = 0; state.lastSaved = 0;
  document.querySelectorAll('.lecture-item').forEach(button => { button.classList.toggle('selected',button.dataset.id === lecture.id); button.setAttribute('aria-current',String(button.dataset.id === lecture.id)); });
  $('lecture-title').textContent = lecture.title; $('stage-label').textContent = '正在读取播放信息'; $('stage-detail').textContent = '正在检查可用画面与平台字幕。';
  playbackStatus('正在读取本课次信息…');
  try {
    const info = await api.lecture(state.course.id,lecture.id,signal);
    if (sequence !== state.sequence) return;
    state.info = info;
    if (!Object.keys(info.streams).length) throw new Error('平台尚未提供可播放画面。请在原站确认回放是否已生成。');
    await state.offsetSave;
    if (sequence !== state.sequence) return;
    const [saved, screenOffset, classroomOffset] = await Promise.all([storage.get(progressKey()),storage.get(offsetKey('screen')),storage.get(offsetKey('classroom'))]);
    if (sequence !== state.sequence) return;
    state.view = info.streams[saved?.view] ? saved.view : state.course.legacy && info.streams.classroom ? 'classroom' : info.streams.screen ? 'screen' : 'classroom';
    state.offsets = {screen:savedOffset(screenOffset),classroom:savedOffset(classroomOffset)};
    state.resume = Math.min(Math.max(0,Number(saved?.time) || 0), Math.max(0,info.duration - 1));
    $('duration').textContent = `时长 ${clock(info.duration)}`; $('play').disabled = false; $('retry').disabled = false; updateViews();
    $('stage-label').textContent = `${viewName(state.view)}已就绪`;
    $('stage-detail').textContent = state.resume > 1 ? `上次 ${clock(state.resume)}` : '';
    $('play').textContent = state.resume > 1 ? '继续观看' : '播放回放'; playbackStatus('待播放');
    try {
      const rows = await api.subtitles(lecture.id,signal);
      if (sequence !== state.sequence) return;
      state.rawSubtitles = rows; $('subtitle-count').textContent = `${rows.length} 段`; $('subtitle-search').disabled = !rows.length;
      $('show-captions').disabled = !rows.length;
      applyTimeline();
    } catch (error) { if (sequence === state.sequence && error.name !== 'AbortError') { $('subtitle-list').replaceChildren(textNode('p',`字幕暂时无法读取：${explain(error)}`,'empty')); $('subtitle-count').textContent = '未读取'; } }
  } catch (error) {
    if (sequence !== state.sequence) return;
    $('stage-label').textContent = '播放信息未就绪'; $('stage-detail').textContent = explain(error); playbackStatus(explain(error),true);
  }
}

async function connectPlayback(time = state.resume, { refresh = false, play = true, automatic = false } = {}) {
  if (!state.selected || !state.info) return;
  const sequence = state.sequence; const courseId = state.course.id, subId = state.selected.id;
  clearMedia(); const epoch = state.mediaEpoch; state.connecting = true; state.resume = Math.max(0,Number(time) || 0);
  $('stage-empty').classList.add('hidden'); playbackStatus(refresh ? '正在重新获取播放地址…' : '正在连接视频…');
  try {
    await api.authenticate({ signal: state.controller.signal, force: refresh });
    if (refresh) {
      const info = await api.lecture(courseId,subId,state.controller.signal);
      if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
      state.info = info;
      if (!automatic) { state.blockedViews.clear(); state.sourceNote = ''; }
      updateViews();
    }
    if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
    let source = state.info.streams[state.view];
    if (!source) throw new Error('当前画面不可用，请切换另一种画面。');
    const probe = await api.probeMedia(source,state.controller.signal);
    if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
    if (!probe.ok) {
      const failedView = state.view, alternate = failedView === 'screen' ? 'classroom' : 'screen';
      state.blockedViews.add(failedView); updateViews();
      const failure = `${viewName(failedView)}源返回 HTTP ${probe.status}`;
      if (!state.info.streams[alternate] || state.blockedViews.has(alternate)) throw new Error(`${failure}，当前没有另一种可用画面。请在原站确认资源状态。`);
      const alternateProbe = await api.probeMedia(state.info.streams[alternate],state.controller.signal);
      if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
      if (!alternateProbe.ok) {
        state.blockedViews.add(alternate); updateViews();
        throw new Error(`${failure}，另一画面也返回 HTTP ${alternateProbe.status}。这是视频源响应，重新加载地址无法补回缺失文件。`);
      }
      state.view = alternate; source = state.info.streams[alternate]; state.calibrating = false; $('calibration-status').textContent = ''; applyTimeline();
      state.sourceNote = `${failure}，已切换${viewName(alternate)}。`; updateViews();
      playbackStatus(state.sourceNote);
    }
    const url = api.sign(source); state.lastSigned = Date.now(); state.attached = true; attachCaptions(); updateCalibration();
    if (new URL(source).pathname.toLowerCase().endsWith('.mp4')) {
      // This path is entered only after playback was explicitly requested. Metadata is also needed for a paused view switch.
      video.preload = 'metadata'; video.src = url;
    }
    else if (globalThis.Hls?.isSupported()) {
      const mediaApi=api, mediaSignal=state.controller.signal;
      const hls = new Hls({ enableWorker: false, maxBufferLength: 20, maxMaxBufferLength: 30, backBufferLength: 15, maxBufferSize: 32 * 1024 * 1024,
        async xhrSetup(xhr, requestUrl) { await mediaApi.prepareMedia?.(mediaSignal); mediaSignal.throwIfAborted();xhr.open('GET',mediaApi.sign(requestUrl),true); xhr.withCredentials = true; } });
      state.hls = hls;
      hls.on(Hls.Events.ERROR,(_event,data) => { if (data.fatal && epoch === state.mediaEpoch) {
        const status = Number(data.response?.code || data.networkDetails?.status || 0);
        handleMediaError(data.type === Hls.ErrorTypes.NETWORK_ERROR ? 'network' : 'decode',status);
      } });
      hls.loadSource(url); hls.attachMedia(video);
    } else throw new Error('当前浏览器不支持此 HLS 视频，请更新 Edge / Chrome，或切换屏幕画面。');
    if (play) {
      try { await video.play(); }
      catch (error) { if (epoch === state.mediaEpoch && error.name === 'NotAllowedError') playbackStatus('请点击视频控制栏上的播放按钮。'); }
    }
  } catch (error) {
    if (epoch !== state.mediaEpoch || sequence !== state.sequence) return;
    state.connecting = false; playbackStatus(explain(error),true);
    if (!state.attached) { $('stage-empty').classList.remove('hidden'); $('stage-label').textContent = '连接未成功'; $('stage-detail').textContent = explain(error); }
  }
}
function handleMediaError(kind, status = 0) {
  if (!state.attached || !state.selected) return;
  state.connecting = false;
  if (kind === 'network' && Date.now() - state.lastRecovery > 30000) {
    state.lastRecovery = Date.now(); void connectPlayback(video.currentTime || state.resume,{ refresh: true, automatic: true }); return;
  }
  playbackStatus(kind === 'decode' ? '浏览器未能识别此视频源。可能是编码不支持或资源响应异常，请切换画面或重新连接。' :
    `视频连接失败${status ? `（HTTP ${status}）` : ''}。请检查校园网 / VPN、代理绕过，再点击重新连接。`,true);
}

$('course-form').addEventListener('submit',event => { event.preventDefault(); void loadCourse(); });
$('play').addEventListener('click',() => { state.lastRecovery = 0; void connectPlayback(state.resume); });
$('retry').addEventListener('click',() => { state.lastRecovery = 0; void connectPlayback(video.currentTime || state.resume,{refresh:true}); });
for (const view of ['screen','classroom']) $(view).addEventListener('click',() => {
  if (state.view === view || !state.info?.streams[view]) return;
  const time = video.currentTime || state.resume, playing = state.attached && !video.paused, attached = state.attached;
  saveProgress(true); state.view = view; state.calibrating = false; $('calibration-status').textContent = ''; applyTimeline(); updateViews();
  if (attached) void connectPlayback(time,{play:playing});
  else { $('stage-label').textContent = `${viewName(view)}已就绪`; }
});
$('speed').addEventListener('change',() => { video.playbackRate = Number($('speed').value); });
$('platform').addEventListener('change',()=> { $('site-link').href=$('platform').value==='legacy'?'https://www.yanhekt.cn/':'https://aita.yanhekt.cn/'; });
$('subtitle-search').addEventListener('input',() => { state.followLyrics = !$('subtitle-search').value.trim(); renderSubtitles(); });
$('return-sync').addEventListener('click',followCurrentLyric);
$('offset-form').addEventListener('submit',event => { event.preventDefault(); setSubtitleOffset($('subtitle-offset').value); });
for (const button of document.querySelectorAll('[data-offset-step]')) button.addEventListener('click',() => setSubtitleOffset(state.offsets[state.view] + Number(button.dataset.offsetStep)));
$('offset-reset').addEventListener('click',() => setSubtitleOffset(0));
$('align-current').addEventListener('click',() => {
  if (!state.attached || !state.rawSubtitles.length) return;
  video.pause(); state.calibrating = true; browseLyrics(); updateCalibration();
  $('calibration-status').textContent = `对齐到 ${subtitleClock(video.currentTime)}：选择字幕`;
});
$('cancel-align').addEventListener('click',() => { state.calibrating = false; updateCalibration(); $('calibration-status').textContent = ''; });
const lyricList = $('subtitle-list');
lyricList.addEventListener('wheel',event => { if (event.deltaY) browseLyrics(); },{passive:true});
lyricList.addEventListener('touchstart',browseLyrics,{passive:true});
lyricList.addEventListener('pointerdown',event => { if (event.target === lyricList) browseLyrics(); });
lyricList.addEventListener('keydown',event => { if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.key) || (event.key === ' ' && event.target === lyricList)) browseLyrics(); });
lyricList.addEventListener('focusin',event => { if (event.target.closest('.subtitle-item')?.matches(':focus-visible')) browseLyrics(); });
new ResizeObserver(() => {
  lyricList.style.setProperty('--lyric-inset',`${Math.max(24,lyricList.parentElement.clientHeight / 2 - 36)}px`);
  scheduleLyricCenter(false);
}).observe(lyricList.parentElement);
$('show-captions').addEventListener('change',() => { for (const track of video.querySelectorAll('track')) track.track.mode = $('show-captions').checked ? 'showing' : 'disabled'; });
video.addEventListener('loadedmetadata',() => {
  if (!state.attached) return;
  video.playbackRate = Number($('speed').value);
  if (state.resume > 0 && Number.isFinite(video.duration)) { state.restoring = true; video.currentTime = Math.min(state.resume,Math.max(0,video.duration - 0.1)); }
  state.connecting = false;
  if (!state.restoring) saveProgress(true);
});
video.addEventListener('playing',() => { state.connecting = false; playbackStatus(`${state.sourceNote}${state.sourceNote ? ' ' : ''}正在播放${viewName(state.view)}`); });
video.addEventListener('timeupdate',() => { updateActiveCue(); saveProgress(); });
video.addEventListener('pause',() => saveProgress(true));
video.addEventListener('seeking',() => {
  if (state.attached && !state.hls && !state.connecting && !state.restoring && Date.now() - state.lastSigned > 45000)
    void connectPlayback(video.currentTime,{play:!video.paused});
});
video.addEventListener('seeked',() => { state.restoring = false; updateActiveCue(); saveProgress(true); if (state.followLyrics) scheduleLyricCenter(); });
video.addEventListener('error',() => { if (state.attached) handleMediaError(video.error?.code === 3 || video.error?.code === 4 ? 'decode' : 'network'); });
window.addEventListener('pagehide',() => { saveProgress(true); state.controller?.abort(); clearMedia(); api.reset(); });

const params = new URLSearchParams(location.search);
const course = params.get('legacy') || params.get('course') || await storage.get('lastCourse');
const legacy = params.has('legacy') || (!params.has('course') && await storage.get('lastPlatform') === 'legacy');
$('platform').value = legacy ? 'legacy' : 'modern';
if (/^\d{1,12}$/.test(course || '')) { $('course-input').value = legacy ? `https://www.yanhekt.cn/course/${course}` : course; void loadCourse(); }
