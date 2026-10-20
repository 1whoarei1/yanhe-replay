# Yanhe Replay · 延河回放助手

在 Edge / Chrome 中观看延河课堂回放，配合可滚动、可搜索、可校准的歌词式字幕。

支持新版 [aita.yanhekt.cn](https://aita.yanhekt.cn/) 和旧版 [www.yanhekt.cn](https://www.yanhekt.cn/)。使用浏览器已有登录状态，无需粘贴 Token，无需本地服务。

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

## 字幕校准

展开「字幕时间校准」，输入偏移秒数：正数延后，负数提前。例如字幕标为 `1:08`，对应讲话实际在视频 `1:30`，填写 `22`。

也可以暂停在那句话的开头，点击「选句对齐」，再点对应字幕，自动计算偏移。校准会同步作用于歌词、高亮、点击跳转和视频内字幕，原始字幕不会被覆盖。

## 登录、隐私与限制

- 登录凭据只从当前浏览器的对应平台取得，在内存中验证和使用，不写入扩展存储。请勿在 Issue 中粘贴 Cookie、Token、手机号或带签名的视频地址。
- 本地仅保存最近课程、播放进度、所选画面和字幕偏移。没有遥测，不上传音视频，不从 CDN 加载脚本，也不提供整课下载功能。
- `cookies` 用于新版站点的 `_token`；旧站仅通过页面脚本读取 `localStorage.auth.token`。`storage` 保存上述偏好；请求头规则只作用于本扩展发起的延河请求。详细站点范围见 [manifest.json](extension/manifest.json)。
- 需要账号正常拥有访问权限及可达的校园网 / VPN / 网络环境。原始视频缺失、服务器故障或不支持的编码仍可能无法播放。
- 新旧站接口可能变化；旧站不同画面可能有不同录制起点，目前保留各视频自身时间轴，字幕可分别校准。
- 这是独立社区项目，与延河课堂及学校无隶属关系。代码许可证不授予课程内容的传播权限。

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

测试覆盖新旧站登录隔离、课程遍历、MP4/HLS 解码、字幕滚动与搜索、时间校准和进度存储。可用 `FFMPEG` 指定 FFmpeg 路径，`BROWSER_EXECUTABLE` 指定浏览器路径，`EXTENSION_PATH` 改为测试打包后的扩展目录。自动化侧载扩展默认使用 Playwright Chromium；参见 [Playwright 文档](https://playwright.dev/docs/chrome-extensions)。

## 参考与致谢

本项目的接口与签名实现参考了以下仓库。感谢作者及维护者公开探索成果，让这个浏览器播放器得以实现：

- **[windlandneko/yanhekit](https://github.com/windlandneko/yanhekit)**：新版延河课堂的课程接口、章节遍历、平台字幕与播放签名，是本项目新版适配的主要参考。
- **[lankerr/BIT_yanhe_download_2026](https://github.com/lankerr/BIT_yanhe_download_2026)**：旧版请求头、HLS 路径签名及短期播放凭据的参考，尤其是 [`utils.py`](https://github.com/lankerr/BIT_yanhe_download_2026/blob/main/utils.py)。同时感谢其上游 **[BITNP/BIT_yanhe_download](https://github.com/BITNP/BIT_yanhe_download)** 的基础工作。
- **[video-dev/hls.js](https://github.com/video-dev/hls.js)**：提供浏览器 HLS 播放能力。
- **[blueimp/JavaScript-MD5](https://github.com/blueimp/JavaScript-MD5)**：用于平台请求签名。
- **[microsoft/playwright](https://github.com/microsoft/playwright)** 与 **[FFmpeg](https://ffmpeg.org/)**：用于浏览器验证和合成测试视频。

Yanhe Replay 将课程访问与播放流程实现为 Manifest V3 扩展；未打包 yanhekit 的 Python 脚本或技能。完整的来源说明与第三方许可证位置见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 许可证

本项目代码采用 [MIT License](LICENSE)。第三方依赖保留各自许可证，相关声明随源码和发布包一并提供。
