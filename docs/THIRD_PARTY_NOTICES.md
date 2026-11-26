# Third-party notices

This private application bundles two OFL-licensed font families. The corresponding full license texts are also copied under `public/licenses/` so static builds can serve them alongside the font assets.

## Manrope Variable

Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope). Licensed under the SIL Open Font License 1.1. Used for interface text from `@fontsource-variable/manrope`. Full license: `public/licenses/Manrope-OFL.txt` and deployed path `/licenses/Manrope-OFL.txt`.

## Roboto

Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic). Licensed under the SIL Open Font License 1.1. Bundled in pdfmake's browser VFS for the synthetic PDF prototype. Full license: `public/licenses/Roboto-OFL.txt` and deployed path `/licenses/Roboto-OFL.txt`.

## Noto Sans JP smoke test

`tests/unit/noto-font-smoke.test.ts` uses `C:\Windows\Fonts\NotoSansJP-Regular.otf` only when that licensed OS font exists. It is not copied into this repository, the bundle or generated app assets. Noto CJK provides upstream SIL OFL licensing; any future redistributed font asset must carry its own matching copyright and license notice.

Other package licenses remain with the installed dependencies and their package metadata. The repository itself is marked `UNLICENSED`; these notices do not grant a license to project code.
