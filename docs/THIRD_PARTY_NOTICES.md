# Third-party notices

This private client-side application includes OFL-licensed font software. Full license texts are served from `public/licenses/` alongside the corresponding static assets.

## Manrope Variable

Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope). Licensed under the SIL Open Font License 1.1. Used for interface text from `@fontsource-variable/manrope`. Full license: `public/licenses/Manrope-OFL.txt` and `/licenses/Manrope-OFL.txt`.

## Roboto

Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic). Licensed under the SIL Open Font License 1.1. Embedded from pdfmake's browser VFS for generated PDFs; Regular and Medium (the VFS bold mapping) provide Latin/romanized text. Full license: `public/licenses/Roboto-OFL.txt` and `/licenses/Roboto-OFL.txt`.

## Noto Sans CJK

Copyright 2014–2024 Adobe (http://www.adobe.com/), with Reserved Font Name “Noto”. Licensed under the SIL Open Font License 1.1. Static OTF SubsetOTF assets are from official upstream Noto CJK release `Sans2.004`, version 2.004. Source tree: [Noto CJK Sans](https://github.com/notofonts/noto-cjk/tree/Sans2.004/Sans/SubsetOTF). Upstream license: [SIL OFL 1.1](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE), copied to `public/licenses/NotoCJK-OFL.txt` and `/licenses/NotoCJK-OFL.txt`.

All files are OpenType CFF OTF, static regular or bold. SHA-256 checksums verify the repository copies:

| File | Bytes | SHA-256 |
|---|---:|---|
| `NotoSansJP-Regular.otf` | 4,533,028 | `DFF723BA59D57D136764A04B9B2D03205544F7CD785A711442D6D2D085AC5073` |
| `NotoSansJP-Bold.otf` | 4,656,448 | `1B0EDFB500B73A4FA8A4FCAAE1BBBD403994E08E73E3E0DA37E70D3853F42C5F` |
| `NotoSansKR-Regular.otf` | 4,644,748 | `69975A0AC8472717870AEFEAB0A4D52739308D90856B9955313B2AD5E0148D68` |
| `NotoSansKR-Bold.otf` | 4,816,044 | `5A6CEB287ED2FC6CFC6213144EBEA68CBD94B20FC9EB873D8486493BF02D9BDA` |
| `NotoSansSC-Regular.otf` | 8,331,336 | `FAA6C9DF652116DDE789D351359F3D7E5D2285A2B2A1F04A2D7244DF706D5EA9` |
| `NotoSansSC-Bold.otf` | 8,543,168 | `C6CB5A93ABAA9EDC8EE7463B7EBB7F42D618D40E6ED2F7A5371C97B0B64767C0` |
| `NotoSansTC-Regular.otf` | 5,683,368 | `5BAB0CB3C1CF89DDE07C4A95A4054B195AFBCFE784D69D75C340780712237537` |
| `NotoSansTC-Bold.otf` | 5,839,972 | `55420B259EB119BF5F2A0AADBA10CF9D736C12D64AB93E78546D69EF5F43558B` |

The eight files total 47,048,112 bytes. They are fetched from same-origin static paths only when a PDF needs that script; PDF generation and font parsing are browser-side. Validation confirmed fontkit parsing/cmap/metrics, pdfmake embedding (`/FontFile3`), PDF.js extraction and Chromium canvas rendering for mixed Korean, Japanese, Simplified Chinese, Traditional Chinese and Latin text. This is a practical documented language/script set, not universal Unicode coverage. Font assets are embedded into generated PDFs; the files remain available as static assets under the OFL.

## Other dependencies

`fontkit` is used to inspect installed font cmap coverage and measure text; other package license texts remain with their installed dependency metadata. The repository itself is marked `UNLICENSED`; third-party notices do not license project code.
