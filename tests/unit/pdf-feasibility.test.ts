import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { generatePdf } from '../../src/features/pdf/generate-pdf';
import { PDF_LAYOUT } from '../../src/features/pdf/layout-config';
import type { PdfGenerationInput } from '../../src/types/domain';

const shortSong: PdfGenerationInput = {
  song: { title: 'Paper Lanterns', artist: 'The Quiet Signals' },
  lyrics: {
    rawText: '[Verse 1]\nLight along the window frame\nThe evening calls us by our names\n\n[Chorus]\nWe carry paper lanterns home',
  },
  layout: PDF_LAYOUT,
};

async function inspectPdf(input: PdfGenerationInput) {
  const { bytes } = await generatePdf(input);
  const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push({
      viewport: page.getViewport({ scale: 1 }),
      items: content.items.filter((item) => 'str' in item).map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        height: item.height,
        width: item.width,
      })),
    });
  }
  return { bytes, pages };
}

describe('PDF feasibility prototype', () => {
  it('generates selectable text on an A4 portrait page with the repeated song header', async () => {
    const { bytes, pages } = await inspectPdf(shortSong);
    const allText = pages.flatMap((page) => page.items.map((item) => item.text)).join(' ');
    const firstPage = pages[0]!;
    const title = firstPage.items.find((item) => item.text === 'Paper Lanterns');
    const artist = firstPage.items.find((item) => item.text === 'The Quiet Signals');
    const firstLyric = firstPage.items.find((item) => item.text === '[Verse 1]');

    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(pages).toHaveLength(1);
    expect(firstPage.viewport.width).toBeCloseTo(595.28, 0);
    expect(firstPage.viewport.height).toBeCloseTo(841.89, 0);
    expect(allText).toContain('Paper Lanterns');
    expect(allText).toContain('The Quiet Signals');
    expect(allText).toContain('We carry paper lanterns home');
    expect(title).toBeDefined();
    expect(artist).toBeDefined();
    expect(firstLyric).toBeDefined();
    expect(title!.x).toBeCloseTo(PDF_LAYOUT.marginMm * 72 / 25.4, 0);
    expect(firstLyric!.x).toBeCloseTo(title!.x, 0);
    expect(firstLyric!.y).toBeLessThan(artist!.y);
    expect(firstLyric!.x + firstLyric!.width).toBeLessThan(firstPage.viewport.width - PDF_LAYOUT.marginMm * 72 / 25.4);
  });

  it('flows ordered synthetic lyrics into successive columns and pages with repeated headers', async () => {
    const lines = Array.from({ length: 240 }, (_, index) => `Flow marker ${String(index + 1).padStart(3, '0')}`);
    const { pages } = await inspectPdf({
      ...shortSong,
      lyrics: { rawText: lines.join('\n') },
    });
    const extracted = pages.flatMap((page) => page.items.map((item) => item.text));
    const markerIndexes = extracted
      .map((text) => /^Flow marker (\d{3})$/.exec(text)?.[1])
      .filter((value): value is string => value !== undefined);
    const firstColumnMarker = pages[0]?.items.find((item) => item.text === 'Flow marker 001');
    const secondColumnMarker = pages[0]?.items.find((item) => item.text !== 'Flow marker 001' && /^Flow marker \d{3}$/.test(item.text) && item.x > (firstColumnMarker?.x ?? 0));

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every((page) => page.items.some((item) => item.text === 'Paper Lanterns'))).toBe(true);
    expect(pages.every((page) => page.items.some((item) => item.text === 'The Quiet Signals'))).toBe(true);
    expect(markerIndexes).toHaveLength(240);
    expect(markerIndexes).toEqual(lines.map((_, index) => String(index + 1).padStart(3, '0')));
    expect(firstColumnMarker).toBeDefined();
    expect(secondColumnMarker).toBeDefined();
    expect(secondColumnMarker!.x).toBeGreaterThan(firstColumnMarker!.x + 100);
    expect(pages.slice(0, -1).every((page) => page.items.some((item) => /^Flow marker \d{3}$/.test(item.text)))).toBe(true);
    expect(pages.every((page) => {
      const artist = page.items.find((item) => item.text === 'The Quiet Signals');
      const body = page.items.filter((item) => /^Flow marker \d{3}$/.test(item.text));
      return artist !== undefined && body.length > 0 && body.every((item) => item.y < artist.y && item.x + item.width < page.viewport.width - PDF_LAYOUT.marginMm * 72 / 25.4);
    })).toBe(true);
    expect(pages.at(-1)?.items.some((item) => item.text === 'Flow marker 240')).toBe(true);
  });

  it('preserves synthetic Filipino and romanized text in the bundled Latin fallback', async () => {
    const sample = 'Mahal kita, kaibigan. Saranghae, yume, ai.';
    const { pages } = await inspectPdf({ ...shortSong, lyrics: { rawText: sample } });
    const extracted = pages.flatMap((page) => page.items.map((item) => item.text)).join(' ');

    expect(extracted).toContain('Mahal kita, kaibigan.');
    expect(extracted).toContain('Saranghae, yume, ai.');
  });
});

it('keeps the A4, portrait, margin, gutter and typography contract centralized', () => {
  expect(PDF_LAYOUT).toMatchObject({
    paperSize: 'A4',
    orientation: 'portrait',
    marginMm: 15,
    columnGapMm: 6,
    titleFontSizePt: 16,
    artistFontSizePt: 11,
    lyricsFontSizePt: 12,
    sectionLabelFontSizePt: 12,
    textColor: '#000000',
    backgroundColor: '#FFFFFF',
  });
});
