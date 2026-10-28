# Yanhe Replay · 延河回放助手

在 Edge / Chrome 中搜索课程、观看新旧延河课堂回放与直播，支持多画面、独立声音、字幕校准和视频下载。

**当前版本：0.5.0** · Edge / Chrome Manifest V3

[下载正式版](https://github.com/1whoarei1/yanhe-replay/releases/latest) · [延河焕新](https://github.com/1whoarei1/yanhe-refine) · [接口参考](https://github.com/1whoarei1/yanhe-api-reference) · [更新记录](CHANGELOG.md)

## 安装或更新

1. 下载 `yanhe-replay-0.5.0.zip`，解压到固定文件夹。
2. 在 `edge://extensions` 或 `chrome://extensions` 开启开发者模式，加载包含 `manifest.json` 的解压目录。
3. 点击扩展图标打开独立播放器，沿用原站登录状态，无需粘贴 Token 或启动本地服务。
4. 更新时替换原目录文件、重新加载扩展并刷新播放器。

## 两份可导入目录

正式 ZIP 的 `课程目录/` 中附带：

| 文件 | 用途 |
| --- | --- |
| `课程目录.json` | 新版课程名称、教师、学期和编号 |
| `旧版课次目录.json` | 我们采集的旧版课程及其明确归属的 session 列表 |
| `导入说明.txt` | 导入步骤、覆盖范围和快照时间 |

本次快照：新版 **27,369 门课程**；旧版 **14,435 门课程、132,050 个 session**。旧版生成时间为 `2026-10-28T10:10:33Z`，采集仍在继续，未收录不代表没有回放。更新目录时重新导入同类文件即可，浏览器会保留已导入目录。

旧版按原站返回的 course ID 聚合 session，课次编号可以不连续。课程、session 和 video 是不同编号；同号不能互相替代。目录不含登录信息、观看记录、成绩、作业或媒体地址，旧版 XLSX 表不分发。目录作为 Release 资产提供，不提交源码仓库。

打开「全校课程」→「导入目录」，依次导入两份 JSON。新版可以离线搜索，也可点「在线查询」获取平台最新列表。旧版目录按明确的 course→session 关系找课；点击后继续向原站解析具体视频。目录导入后保存在本浏览器，播放仍需登录及相应权限。

## 播放与下载

- 课程链接、旧站 session 链接和具体直播链接可以直接粘贴，课程、课次、视频片段分别处理，刷新后保留当前目标。
- 支持 HLS、FLV、MP4；底栏集中播放、进度、倍速、字幕、音量与两种全屏，停止操作后自动隐藏。
- 双画面可选屏幕、教室或学生；直播三画面采用左大右上下。声音独立选一路，支持未显示的画面提供声音。
- 字幕随画面大小定位，控件显示时上移避让，可搜索并校准时间偏移；字幕表和视频内字幕分别开关。
- 签到模式展示最新已缓存画面并保持声音连续，不提交点名或签到请求。
- 可关联同一堂课的新旧站直播，根据课程信息和时间重新定位课次；不会按相同数字 ID 自动对应。
- 下载视频保持独立标签页，提供分画面、分段与播放进度；登录或媒体地址失效时明确报错。

## 开发与打包

```sh
npm ci
npm run build
npm test
npm run test:browser:layout
npm run test:browser:streams
npm run test:browser:imports
```

源码不含课程数据。将 Release 两份 JSON 放到 `local-data/release-catalog.json` 与 `local-data/release-session-index.json` 后，运行 `python tools/package.py --with-imports`。不带目录的开发构建仍可使用 `python tools/package.py`。

验证使用隔离浏览器和合成响应/媒体；实际目录导入测试不下载校园录像，也不能代替真实账号的直播验收。

## 来源与致谢

公开感谢 **[bit-admin / Yanhekt-AutoSlides](https://github.com/bit-admin/Yanhekt-AutoSlides)** 的 session 索引实现、在线协议与旧站元数据研究。旧版快照为我们独立采集的明文课程元数据，不是上游加密 Release 的解密产物。

与 [延河焕新](https://github.com/1whoarei1/yanhe-refine) 共用播放、字幕和下载改进，协议参考包含 [yanhekit](https://github.com/windlandneko/yanhekit)。来源与第三方许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)，本项目采用 MIT 许可证。
