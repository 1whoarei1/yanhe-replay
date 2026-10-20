# References and third-party notices

Yanhe Replay's own code is distributed under the [MIT License](LICENSE).
Third-party components retain their original licenses.

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
| [blueimp/JavaScript-MD5](https://github.com/blueimp/JavaScript-MD5) 2.19.0 | Platform request signing | MIT, [extension/vendor/md5.LICENSE](extension/vendor/md5.LICENSE) |

`tools/build.mjs` copies these files from the pinned npm packages. No vendor
scripts are fetched from a CDN at runtime.

## Development tools

[Microsoft Playwright](https://github.com/microsoft/playwright) (Apache-2.0) runs
browser tests. [FFmpeg](https://ffmpeg.org/) generates local synthetic test media.
Neither tool is bundled with the extension; FFmpeg's license depends on the build
installed by the developer. Generated fixtures contain no classroom recordings.
