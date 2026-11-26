// @vitest-environment node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const notoFontPath = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts', 'NotoSansJP-Regular.otf');
const hasLocalNotoFont = existsSync(notoFontPath);

describe.skipIf(!hasLocalNotoFont)('licensed Noto CJK font smoke test', () => {
  it('embeds the local Noto JP face and exposes Japanese/Chinese text while detecting missing Hangul', async () => {
    const pdfmake = require('pdfmake') as typeof import('pdfmake');
    const roboto = require('pdfmake/fonts/Roboto') as Parameters<typeof pdfmake.addFonts>[0];
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy((localPath) => localPath === notoFontPath);
    pdfmake.addFonts(roboto);
    pdfmake.addFonts({ NotoJP: { normal: notoFontPath } });

    const bytes = await pdfmake.createPdf({
      defaultStyle: { font: 'NotoJP', fontSize: 12 },
      content: 'Filipino: Mahal kita. Korean: 사랑은 우리 곁에 있어요. Japanese: 夢を見て歩こう。 Chinese: 愛與希望同行。 Romanized: saranghae, yume, ai.',
    }).getBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
    try {
      const document = await loadingTask.promise;
      const content = await document.getPage(1).then((page) => page.getTextContent());
      const extracted = content.items.filter((item) => 'str' in item).map((item) => item.str).join(' ');
      const compact = extracted.replace(/\s+/g, '');

      expect(compact).toContain('夢を見て歩こう。');
      expect(compact).toContain('愛與希望同行。');
      expect(compact).toContain('Mahalkita.');
      expect(compact).toContain('saranghae,yume,ai.');
      expect(extracted).toContain('\u0000');
    } finally {
      await loadingTask.destroy();
    }
  });
});
