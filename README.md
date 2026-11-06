# 延河回放助手

在 Edge / Chrome 中搜索课程，观看新旧延河课堂的回放与直播。

[下载 0.6.0](https://github.com/1whoarei1/yanhe-replay/releases/latest) · [更新记录](CHANGELOG.md) · [延河焕新](https://github.com/bitoolkit/yanhe-refine) · [接口参考](https://github.com/1whoarei1/yanhe-api-reference)

**0.6.0 重要更新。** 修复直播 403，新增新旧站直播自动识别与切换。

## 功能

- 内置新旧课程目录，首次打开即可搜索，也可手动导入更新目录。
- 旧站回放优先使用 v1 接口，支持 session 直达、多片段切换和进度恢复。
- 直播支持双屏、三屏，右上角显示当前来源并切换新旧站。
- 支持倍速、字幕校准、独立音量、网页全屏与屏幕全屏。
- 签到模式显示最新缓存画面，视频下载在独立标签页进行。

## 安装与更新

1. 下载 `yanhe-replay-0.6.0.zip`，解压到固定文件夹。
2. 在 `edge://extensions` 或 `chrome://extensions` 开启开发者模式，加载含 `manifest.json` 的目录。
3. 登录延河课堂后，点击扩展图标打开播放器。

更新时替换原目录文件、重新加载扩展，再刷新播放器。课程目录随包内置，观看需登录课堂。

## 致谢

感谢 [bit-admin / Yanhekt-AutoSlides](https://github.com/bit-admin/Yanhekt-AutoSlides) 的旧版课次索引研究、[mmck111 / yanhekt-player](https://github.com/mmck111/yanhekt-player) 的往年回放读取思路，以及 [yanhekit](https://github.com/windlandneko/yanhekit) 和下载工具作者的协议参考。

[MIT 许可证](LICENSE) · [第三方声明](THIRD_PARTY_NOTICES.md)
