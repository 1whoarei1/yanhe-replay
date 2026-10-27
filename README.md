# Yanhe Replay · 延河回放助手

在 Edge / Chrome 中搜索全校课程、观看回放与直播，支持双画面、视频下载和歌词式平台字幕。

支持新版 [aita.yanhekt.cn](https://aita.yanhekt.cn/) 和旧版 [www.yanhekt.cn](https://www.yanhekt.cn/)。使用浏览器已有登录状态，无需粘贴 Token，无需本地服务。

**当前版本：0.4.0。** Replay 保持独立播放器界面，整合 [延河焕新](https://github.com/1whoarei1/yanhe-refine) 的播放与下载更新。

直播支持主画面、屏幕与学生画面、HLS/FLV、备用源和回到直播。平台的网页许可字段可能与媒体端响应不一致：播放器保留该字段用于诊断，连接平台实际返回的媒体源；媒体源的 401/403、缺失或解码错误仍会正常报告。

## 0.4.0 更新

- **全校课程**：在线搜索新版平台课程，支持课程名、教师、课程 ID、学期与学院筛选和分页；点击结果载入对应课程，再选择课次播放。使用平台当前索引，显示平台返回总数，不把历史目录当作实时全量。
- **双画面**：同时观看屏幕和教室，共用暂停、拖动、倍速，选择单一声音或静音，支持一起全屏。副画面失败时保留主画面。
- **下载视频**：按课次选择屏幕、教室或全部可用画面，分别保存文件。MP4 流式写入，完整 HLS 合并为 TS / MP4，支持标准 AES-128、字节范围、停止和失败重试。
- **回放缓存**：按平台和账号保存课次元数据，返回或刷新播放器恢复上次课次；普通列表缓存 10 分钟，含直播安排的列表最多 20 秒，点击「刷新」立即重新读取。
- **旧站直播**：保留 `/live/…` 的直播身份，适配旧站实际返回的画面、预告与结束状态；session 链接继续定位对应回放。
- **布局**：充分使用宽屏，可收起课次与字幕，窄屏重新排列视频和搜索结果。保留已有进度和字幕校准存储键。

## 功能

- 读取课程和回放列表，切换屏幕、教室或主画面，支持 MP4 / HLS、倍速和播放进度记忆。
- 歌词式平台字幕：当前句高亮并居中，鼠标滚动自由浏览，点击字幕跳转，搜索完整字幕。
- 手动校准字幕时间：整体提前 / 延后、0.5 秒微调、选句对齐；按平台、课程、课次、画面分别记忆。
- 歌词列表与视频内字幕使用同一时间轴。平台没有字幕时保留空状态，不执行 ASR。
- 点击播放后才请求视频流；所选画面不可用时尝试另一可用画面并显示源端状态。

## 安装

1. 从 [Releases](https://github.com/1whoarei1/yanhe-replay/releases) 下载 `yanhe-replay-版本.zip`，解压到固定目录。
2. 打开 `edge://extensions` 或 `chrome://extensions`，开启「开发人员模式」，点击「加载解压缩的扩展」。
3. 选择直接包含 `manifest.json` 的解压目录。
4. 在**同一个浏览器个人资料**中登录对应延河课堂站点，刷新课程页，点击右下角「用回放助手打开」。也可点击工具栏扩展图标后粘贴课程链接。

从源码安装时，直接加载仓库的 **`extension/`** 目录；源码中已附运行所需依赖，不必先安装 Node.js。更新文件后，在扩展管理页重新加载扩展，再刷新课程页和播放器。

完整课程链接会自动识别新旧平台；只输入数字 ID 时，先选择平台。新旧站的课程 ID 与登录状态独立，旧站课程无需在新版搜索中找到。

旧站同时支持 `/course/<课程ID>`、`/live/<直播ID>`、`/session/<课次ID>` 和 `/ReadSession/<课次ID>`。直播页和回放页通过旧站接口还原所属课程，不把直播/课次编号当成课程编号。有对应录播时自动选中；尚无对应录播时载入所属课程并提示。旧版直播使用旧站返回的直播源，新版直播使用新版直播房间链接。

## 字幕校准

展开「字幕时间校准」，输入偏移秒数：正数延后，负数提前。例如字幕标为 `1:08`，对应讲话实际在视频 `1:30`，填写 `22`。

也可以暂停在那句话的开头，点击「选句对齐」，再点对应字幕，自动计算偏移。校准会同步作用于歌词、高亮、点击跳转和视频内字幕，原始字幕不会被覆盖。

## 视频下载

在课次上点击「下载视频」，选择屏幕、教室或「全部画面」，再选择保存文件夹。双画面观看时默认勾选全部可下载画面。每路文件按课程和课次分别保存，同名文件自动另存。

保持下载页打开。完整 HLS 回放按顺序合并，缺失分段或停止后不会标为完成；失败重试会重新下载当前画面，已完成画面跳过。暂不支持断点续传、直播录制、独立音轨和 SAMPLE-AES。文件通过浏览器文件夹选择器授权保存。

## 登录、隐私与限制

- 登录凭据只从当前浏览器的对应平台取得，在内存中验证和使用，不写入扩展存储。请勿在 Issue 中粘贴 Cookie、Token、手机号或带签名的视频地址。
- 本地保存最近课程、播放进度、所选画面和字幕偏移；浏览器会话内缓存课程与课次元数据，不保存 token 或签名媒体 URL。课程搜索读取平台在线索引。没有遥测，不上传音视频，不从 CDN 加载脚本。
- `cookies` 用于新版站点的 `_token`；旧站仅通过页面脚本读取 `localStorage.auth.token`。`storage` 保存上述偏好；请求头规则只作用于本扩展发起的延河请求。详细站点范围见 [manifest.json](extension/manifest.json)。
- 需要账号正常拥有访问权限及可达的校园网 / VPN / 网络环境。原始视频缺失、服务器故障或不支持的编码仍可能无法播放。
- 新旧站接口可能变化；旧站不同画面可能有不同录制起点，目前保留各视频自身时间轴，字幕可分别校准。
- 这是独立社区项目，与延河课堂及学校无隶属关系。代码许可证不授予课程内容的传播权限。

## 贡献与 PR

平台接口开发请参考 **[延河课堂底层接口文档](https://github.com/1whoarei1/yanhe-api-reference)**。PR 请说明改动、对应接口和验证范围，示例使用脱敏数据。新接口及协议变化欢迎同步补充到接口文档仓库。

## 开发与验证

需要 Node.js 20+；打包另需 Python 3。

```sh
npm ci
npm run build
npm test
python tools/package.py
```

`build` 从固定版本的 npm 依赖复制播放库、许可证并生成图标。打包输出到 `dist/`，ZIP 根目录直接包含 `manifest.json`，并逐文件核对内容。

浏览器测试使用 Playwright 的 Chromium、隔离临时个人资料、模拟平台接口与本地生成的视频，不访问真实课程或使用真实账号。先安装 [FFmpeg](https://ffmpeg.org/)，然后运行：

```sh
npx playwright install chromium
npm run test:fixtures
npm run test:browser
```

测试覆盖新旧站登录隔离、课程遍历、MP4/HLS 解码、字幕滚动与搜索、时间校准和进度存储。另测试直播深链、预告/结束/拒绝状态、HLS/FLV 解码、备用画面与直播进度隔离，可用 `npm run test:browser:live` 单独运行。新增双画面、在线课程搜索、缓存和下载测试可分别运行 `npm run test:browser:upgrade` 与 `npm run test:browser:download`。直播媒体使用有限长度的合成文件验证传输与解码，不代表已经验证真实直播延迟或持续播放。可用 `FFMPEG` 指定 FFmpeg 路径，`BROWSER_EXECUTABLE` 指定浏览器路径，`EXTENSION_PATH` 改为测试打包后的扩展目录。自动化侧载扩展默认使用 Playwright Chromium；参见 [Playwright 文档](https://playwright.dev/docs/chrome-extensions)。

## 参考与致谢

本项目的接口与签名实现参考了以下仓库。感谢作者及维护者公开探索成果，让这个浏览器播放器得以实现：

- **[1whoarei1/yanhe-refine](https://github.com/1whoarei1/yanhe-refine)**：双画面、流式下载、回放缓存、旧站直播与课程元数据适配的同步来源。
- **[windlandneko/yanhekit](https://github.com/windlandneko/yanhekit)**：新版延河课堂的课程接口、章节遍历、平台字幕与播放签名，是本项目新版适配的主要参考。
- **[lankerr/BIT_yanhe_download_2026](https://github.com/lankerr/BIT_yanhe_download_2026)**：旧版请求头、HLS 路径签名及短期播放凭据的参考，尤其是 [`utils.py`](https://github.com/lankerr/BIT_yanhe_download_2026/blob/main/utils.py)。同时感谢其上游 **[BITNP/BIT_yanhe_download](https://github.com/BITNP/BIT_yanhe_download)** 的基础工作。
- **[video-dev/hls.js](https://github.com/video-dev/hls.js)**：提供浏览器 HLS 播放能力。
- **[xqq/mpegts.js](https://github.com/xqq/mpegts.js)**：提供 FLV 直播的浏览器播放能力。
- **[blueimp/JavaScript-MD5](https://github.com/blueimp/JavaScript-MD5)**：用于平台请求签名。
- **[microsoft/playwright](https://github.com/microsoft/playwright)** 与 **[FFmpeg](https://ffmpeg.org/)**：用于浏览器验证和合成测试视频。

Yanhe Replay 将课程访问与播放流程实现为 Manifest V3 扩展；未打包 yanhekit 的 Python 脚本或技能。完整的来源说明与第三方许可证位置见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 许可证

本项目代码采用 [MIT License](LICENSE)。第三方依赖保留各自许可证，相关声明随源码和发布包一并提供。
