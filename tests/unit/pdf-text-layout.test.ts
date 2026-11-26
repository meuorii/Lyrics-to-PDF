import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { create as createFont } from 'fontkit';
import { describe, expect, it } from 'vitest';
import type { ResolvedFontRun } from '../../src/features/pdf/font-fallback';
import { wrapResolvedText } from '../../src/features/pdf/text-layout';
import { getPdfFontMetrics } from '../../src/features/pdf/font-registry';

describe('PDF Unicode text layout', () => {
  it('wraps Latin words and splits long unbroken tokens without dropping characters', () => {
    const face = getPdfFontMetrics().regular;
    const runs: ResolvedFontRun[] = [{ text: 'Lanterns travel through the quiet valley ', font: 'Roboto', face, bold: false }];
    const lines = wrapResolvedText(runs, 88, 12);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((line) => line.runs.map((run) => run.text).join('')).join('')).toBe(runs[0]!.text);
    const token: ResolvedFontRun[] = [{ text: 'W'.repeat(100), font: 'Roboto', face, bold: false }];
    const tokenLines = wrapResolvedText(token, 60, 12);
    expect(tokenLines.length).toBeGreaterThan(1);
    expect(tokenLines.map((line) => line.runs.map((run) => run.text).join('')).join('')).toBe(token[0]!.text);
  });

  it('wraps CJK at Unicode line-break opportunities and preserves grapheme clusters', async () => {
    const bytes = await readFile(join(process.cwd(), 'public/fonts/pdf/NotoSansJP-Regular.otf'));
    const face = createFont(bytes);
    const text = '日本語、かなカナ漢字'.repeat(8);
    const lines = wrapResolvedText([{ text, font: 'NotoJP', face, bold: false }], 80, 12);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((line) => line.runs.map((run) => run.text).join('')).join('')).toBe(text);
    for (const line of lines) expect(line.widthPt).toBeLessThanOrEqual(80.01);
  });

  it('keeps combining marks attached and allows an exact measured-width fit', () => {
    const face = getPdfFontMetrics().regular;
    const text = 'Cafe\u0301';
    const run: ResolvedFontRun = { text, font: 'Roboto', face, bold: false };
    const lines = wrapResolvedText([run], face.layout(text).advanceWidth / face.unitsPerEm * 12, 12);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.runs.map((item) => item.text).join('')).toBe(text);
  });
});
