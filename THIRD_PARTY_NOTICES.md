# References and third-party notices

Yanhe Replay's own code is distributed under the [MIT License](LICENSE).
Third-party components retain their original licenses.

## Shared playback implementation

[1whoarei1/yanhe-refine](https://github.com/1whoarei1/yanhe-refine), v0.9.3
(revision `8a292f47d7f25a697d01c9bd7c69189ce2edbf5a`, MIT), is the source of the
backported dual playback, media downloader, replay cache, legacy live support
and course metadata normalization. Replay retains its independent interface.
Protocol documentation: [yanhe-api-reference](https://github.com/1whoarei1/yanhe-api-reference).

## Protocol references

- [windlandneko/yanhekit](https://github.com/windlandneko/yanhekit): reference for
  the modern platform's course traversal, platform transcripts and playback signing.
  The initial reference revision was `a85de3ab6b0dfad6b4440775a6057ccab2881270`.
  This repository does not bundle the yanhekit Python scripts or skills, and its MIT
  license does not purport to license that upstream project.
- [lankerr/BIT_yanhe_download_2026](https://github.com/lankerr/BIT_yanhe_download_2026),
  particularly `utils.py`: reference for legacy request headers, media path signing
  and video-token refresh. That project is based on
  [BITNP/BIT_yanhe_download](https://github.com/BITNP/BIT_yanhe_download).
  Its MIT notice (Copyright 2023 AuYang261) is preserved in
  [licenses/BIT_yanhe_download.LICENSE](licenses/BIT_yanhe_download.LICENSE).

Thank you to these authors and maintainers for making the platform protocols
and tooling easier to understand.

## Bundled runtime components

| Component | Purpose | License and included notice |
| --- | --- | --- |
| [video-dev/hls.js](https://github.com/video-dev/hls.js) 1.7.3 | HLS playback | Apache-2.0, [extension/vendor/hls.LICENSE](extension/vendor/hls.LICENSE) |
| [xqq/mpegts.js](https://github.com/xqq/mpegts.js) 1.8.2 | FLV live playback | Apache-2.0, [extension/vendor/mpegts.LICENSE](extension/vendor/mpegts.LICENSE); bundled dependency notice: [extension/vendor/mpegts.NOTICE.txt](extension/vendor/mpegts.NOTICE.txt) |
| [blueimp/JavaScript-MD5](https://github.com/blueimp/JavaScript-MD5) 2.19.0 | Platform request signing | MIT, [extension/vendor/md5.LICENSE](extension/vendor/md5.LICENSE) |

`tools/build.mjs` copies these files from the pinned npm packages. No vendor
scripts are fetched from a CDN at runtime.

## Development tools

[Microsoft Playwright](https://github.com/microsoft/playwright) (Apache-2.0) runs
browser tests. [FFmpeg](https://ffmpeg.org/) generates local synthetic test media.
Neither tool is bundled with the extension; FFmpeg's license depends on the build
installed by the developer. Generated fixtures contain no classroom recordings.

## Yanhekt-AutoSlides：协议与索引来源

感谢 [bit-admin/Yanhekt-AutoSlides](https://github.com/bit-admin/Yanhekt-AutoSlides) 的公开 session 索引、在线查询 API 及旧站元数据研究。参考修订 `746cd87ccc4da59cb838adc023200531aa379a85` 的 `share/docs/api.md` 和 `indexer/src/yanhekt.ts`；上游采用 [Apache-2.0](https://github.com/bit-admin/Yanhekt-AutoSlides/blob/746cd87ccc4da59cb838adc023200531aa379a85/LICENSE)。本项目依据公开 HTTP 契约独立编写客户端，没有复制上游实现模块、打包加密数据库或引入构建密钥。在线索引仍在完善，实际覆盖与可用性由该服务决定。

HLS playback uses the full hls.js 1.7.3 build so platform-provided alternate audio playlists can be loaded. The upstream Apache-2.0 license remains included.
