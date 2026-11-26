import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { generatePdf } from '../../src/features/pdf/generate-pdf';
import { PDF_LAYOUT } from '../../src/features/pdf/layout-config';
import { processSongInput } from '../../src/features/lyrics/validate-input';
import { PAPER_SIZES } from '../../src/features/paper/paper-sizes';
import type { PaperSelection, ValidatedSong } from '../../src/types/domain';

function validSong(paper: PaperSelection, rawLyrics = '[Verse 1]\nA little light is shining', title = 'Paper Lanterns', artist = 'The Quiet Signals'): ValidatedSong {
  const result = processSongInput({ title, artist, rawLyrics, paper });
  if (!result.success) throw new Error('Synthetic Phase 3 fixture must validate.');
  return result.data;
}

async function inspect(snapshot: Awaited<ReturnType<typeof generatePdf>>) {
  const loadingTask = pdfjs.getDocument({ data: snapshot.bytes.slice() });
  const document = await loadingTask.promise;
  try {
    const pages = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent({ disableNormalization: true });
      pages.push({
        viewport: page.getViewport({ scale: 1 }),
        items: content.items.filter((item) => 'str' in item).map((item) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          height: item.height,
          width: item.width,
          fontName: item.fontName,
        })),
      });
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

describe('production PDF generation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const filename = new URL(String(input)).pathname.split('/').at(-1)!;
      return new Response(await readFile(join(process.cwd(), 'public/fonts/pdf', filename)));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders a non-A4 paper size instead of rejecting it', async () => {
    const result = await generatePdf(validSong({ size: 'A5' }));
    const page = (await inspect(result))[0]!;
    expect(page.viewport.width).toBeCloseTo(148 * 72 / 25.4, 1);
    expect(page.viewport.height).toBeCloseTo(210 * 72 / 25.4, 1);
  });

  it.each(Object.entries(PAPER_SIZES))('uses exact portrait dimensions for %s', async (size, dimensions) => {
    const snapshot = await generatePdf(validSong({ size: size as keyof typeof PAPER_SIZES }));
    const page = (await inspect(snapshot))[0]!;
    expect(page.viewport.width).toBeCloseTo(dimensions.width * 72 / 25.4, 1);
    expect(page.viewport.height).toBeCloseTo(dimensions.height * 72 / 25.4, 1);
    expect(snapshot.paper.size).toBe(size);
  });

  it('produces matching snapshots for custom millimeter and inch dimensions', async () => {
    const mm = await generatePdf(validSong({ size: 'Custom', custom: { width: 215.9, height: 279.4, unit: 'mm' } }));
    const inches = await generatePdf(validSong({ size: 'Custom', custom: { width: 8.5, height: 11, unit: 'in' } }));
    expect((await inspect(mm))[0]?.viewport.width).toBeCloseTo((await inspect(inches))[0]!.viewport.width, 3);
    expect((await inspect(mm))[0]?.viewport.height).toBeCloseTo((await inspect(inches))[0]!.viewport.height, 3);
  });

  it('returns a selectable one-page PDF snapshot with matching blob bytes and safe metadata', async () => {
    const snapshot = await generatePdf(validSong({ size: 'A4' }, '[Verse 1: Artist A]\nKeep the light!'));
    const pages = await inspect(snapshot);
    const text = pages.flatMap((page) => page.items.map((item) => item.text)).join(' ');
    expect(new TextDecoder().decode(snapshot.bytes.slice(0, 8))).toContain('%PDF-');
    expect(snapshot.blob.type).toBe('application/pdf');
    expect(new Uint8Array(await snapshot.blob.arrayBuffer())).toEqual(snapshot.bytes);
    expect(snapshot.pageCount).toBe(1);
    expect(text).toContain('[Verse 1]');
    expect(text).toContain('Keep the light!');
    expect(text).not.toContain('Artist A');
    expect(snapshot.filename).toBe('The Quiet Signals - Paper Lanterns.pdf');
    expect(snapshot.bytes.byteLength).toBeGreaterThan(1000);
  });

  it('embeds the licensed regular and bold font variants and preserves section-rich lyrics', async () => {
    const raw = 'Opening line\n\n[Verse 2: Performer A]\nShe said: keep the light!\n\nSecond stanza\n\n[Unknown section: Artist B]\n(Keep these words.)\n\n[Chorus]\nTogether again\nTogether again';
    const snapshot = await generatePdf(validSong({ size: 'A4' }, raw));
    const pages = await inspect(snapshot);
    const body = pages.flatMap((page) => page.items.map((item) => item.text));
    const pdfSource = new TextDecoder('latin1').decode(snapshot.bytes);
    expect(pdfSource).toContain('/FontFile2');
    expect(body.indexOf('Opening line')).toBeLessThan(body.indexOf('[Verse 2]'));
    expect(body).toContain('[Unknown section: Artist B]');
    expect(body).toContain('(Keep these words.)');
    expect(body).toContain('She said: keep the light!');
    expect(body.filter((text) => text === 'Together again')).toHaveLength(2);
    expect(body).not.toContain('[Verse 2: Performer A]');
  });

  it('keeps the repeated header within the margins and the lyric body below it', async () => {
    const snapshot = await generatePdf(validSong({ size: 'A4' }));
    const pages = await inspect(snapshot);
    const first = pages[0]!;
    const title = first.items.find((item) => item.text === 'Paper Lanterns')!;
    const artist = first.items.find((item) => item.text === 'The Quiet Signals')!;
    const label = first.items.find((item) => item.text === '[Verse 1]')!;
    const marginPt = 15 * 72 / 25.4;
    expect(title.x).toBeCloseTo(marginPt, 0);
    expect(artist.x).toBeCloseTo(marginPt, 0);
    expect(label.x).toBeCloseTo(marginPt, 0);
    expect(title.y).toBeGreaterThan(artist.y);
    expect(artist.y).toBeGreaterThan(label.y);
    expect(title.fontName).not.toBe(label.fontName);
    expect(title.height / label.height).toBeGreaterThan(1.2);
    expect(title.height / label.height).toBeLessThan(1.5);
    expect(artist.height / label.height).toBeGreaterThan(0.8);
    expect(artist.height / label.height).toBeLessThan(1.1);
    expect(first.items.every((item) => item.x + item.width <= first.viewport.width - marginPt + 1)).toBe(true);
  });

  it('keeps a short song in the first column without artificial balancing', async () => {
    const snapshot = await generatePdf(validSong({ size: 'A4' }, '[Verse]\nOnly one lyric line'));
    const page = (await inspect(snapshot))[0]!;
    const lyrics = page.items.filter((item) => item.text === '[Verse]' || item.text === 'Only one lyric line');
    expect(lyrics).toHaveLength(2);
    expect(new Set(lyrics.map((item) => item.x)).size).toBe(1);
  });

  it('repeats the header and preserves every ordered marker across continuous columns and pages', async () => {
    const lyrics = Array.from({ length: 240 }, (_, index) => `Flow marker ${String(index + 1).padStart(3, '0')}`).join('\n');
    const snapshot = await generatePdf(validSong({ size: 'A4' }, lyrics));
    const pages = await inspect(snapshot);
    const texts = pages.flatMap((page) => page.items.map((item) => item.text));
    const markers = texts.map((text) => /^Flow marker (\d{3})$/.exec(text)?.[1]).filter((value): value is string => value !== undefined);
    expect(pages.length).toBeGreaterThan(1);
    expect(markers).toEqual(Array.from({ length: 240 }, (_, index) => String(index + 1).padStart(3, '0')));
    expect(pages.every((page) => page.items.some((item) => item.text === 'Paper Lanterns') && page.items.some((item) => item.text === 'The Quiet Signals'))).toBe(true);
    expect(snapshot.pageCount).toBe(pages.length);
    expect(pages.at(-1)?.items.some((item) => item.text === 'Flow marker 240')).toBe(true);
    const firstPage = pages[0]!;
    const firstMarker = firstPage.items.find((item) => item.text === 'Flow marker 001')!;
    const nextColumnMarker = firstPage.items.find((item) => /^Flow marker \d{3}$/.test(item.text) && item.x > firstMarker.x)!;
    const columnWidthPt = (firstPage.viewport.width - 2 * 15 * 72 / 25.4 - 6 * 72 / 25.4) / 2;
    expect(nextColumnMarker.x).toBeCloseTo(firstMarker.x + columnWidthPt + 6 * 72 / 25.4, 0);
    expect(firstPage.items.every((item) => item.x + item.width <= firstPage.viewport.width - 15 * 72 / 25.4 + 1)).toBe(true);
  });

  it('rejects unsupported glyphs instead of creating corrupted PDF text', async () => {
    await expect(generatePdf(validSong({ size: 'A4' }, '🛠'))).rejects.toMatchObject({ code: 'unsupported-glyph' });
  });

  it('embeds appropriate fonts for Korean, Japanese, Simplified and Traditional Chinese in mixed text', async () => {
    const lyric = 'Bahay-kubo sa ilalim ng punong mangga; Cafe\u0301; 한국어 日本語かなカナ 简体中文 繁體中文 English';
    const snapshot = await generatePdf(validSong({ size: 'A4' }, lyric, '日本語와 English', '작가 Artist'));
    const pages = await inspect(snapshot);
    const text = pages.flatMap((page) => page.items.map((item) => item.text)).join('');
    const body = pages.flatMap((page) => page.items.filter((item) => item.y < page.viewport.height - 15 * 72 / 25.4 - 16 - 11 - 12 + 2).map((item) => item.text)).join('').replace(/\s+/gu, '');
    expect(body.normalize('NFC')).toContain(lyric.replace(/\s+/gu, '').normalize('NFC'));
    expect(text).toContain('日本語와 English');
    expect(text).toContain('작가 Artist');
    expect(new TextDecoder('latin1').decode(snapshot.bytes)).toContain('/FontFile3');
  }, 30_000);

  it('wraps CJK lines at grapheme boundaries and preserves all characters', async () => {
    const lyric = '日本語歌詞'.repeat(20);
    const snapshot = await generatePdf(validSong({ size: 'A6' }, lyric));
    const pages = await inspect(snapshot);
    const body = pages.flatMap((page) => page.items.filter((item) => item.text !== 'Paper Lanterns' && item.text !== 'The Quiet Signals').map((item) => item.text)).join('');
    expect(body).toBe(lyric);
    expect(pages.flatMap((page) => page.items).filter((item) => item.text.length > 0).length).toBeGreaterThan(1);
  });

  it('wraps long title and artist and places body after the measured repeated header', async () => {
    const title = '日本語の長い曲名 '.repeat(8).trim();
    const artist = '作曲家と歌手 '.repeat(8).trim();
    const snapshot = await generatePdf(validSong({ size: 'A4' }, 'Header follows the lyrics', title, artist));
    const pages = await inspect(snapshot);
    expect(pages[0]!.items.some((item) => item.text === 'Header follows the lyrics')).toBe(true);
    for (const page of pages) {
      const titleItems = page.items.filter((item) => item.text.length > 0 && title.includes(item.text));
      const artistItems = page.items.filter((item) => item.text.length > 0 && artist.includes(item.text));
      expect(titleItems.length).toBeGreaterThan(1);
      expect(artistItems.length).toBeGreaterThan(1);
      const lowestHeader = Math.min(...[...titleItems, ...artistItems].map((item) => item.y));
      const body = page.items.find((item) => item.text === 'Header follows the lyrics');
      if (body) expect(body.y).toBeLessThan(lowestHeader - 12);
    }
  });

  it('keeps a section label with its first lyric line when approaching a column boundary', async () => {
    const before = Array.from({ length: 23 }, (_, index) => 'Previous ' + index).join('\n');
    const snapshot = await generatePdf(validSong({ size: 'A6' }, `${before}\n\n[Chorus]\nTogether we sing`));
    const pages = await inspect(snapshot);
    const label = pages.flatMap((page) => page.items).find((item) => item.text === '[Chorus]')!;
    const firstLine = pages.flatMap((page) => page.items).find((item) => item.text === 'Together we sing')!;
    expect(label).toBeDefined();
    expect(firstLine).toBeDefined();
    expect(label.x).toBeCloseTo(firstLine.x, 1);
    const lastPrevious = pages.flatMap((page) => page.items).find((item) => item.text === 'Previous 22')!;
    expect(label.x).toBeGreaterThan(lastPrevious.x);
    expect(label.y).toBeGreaterThan(firstLine.y);
  });

  it.each([{ precedingLines: 23, expectedPage: 0 }, { precedingLines: 47, expectedPage: 1 }])(
    'keeps the section start together at a real column/page boundary after $precedingLines lyric lines',
    async ({ precedingLines, expectedPage }) => {
      const before = Array.from({ length: precedingLines }, (_, index) => 'P' + String(index + 1).padStart(2, '0')).join('\n');
      const snapshot = await generatePdf(validSong({ size: 'A6' }, before + '\n\n[Chorus]\nFirst chorus line'));
      const pages = await inspect(snapshot);
      const labelPageIndex = pages.findIndex((page) => page.items.some((item) => item.text === '[Chorus]'));
      expect(snapshot.pageCount).toBe(expectedPage + 1);
      expect(labelPageIndex).toBe(expectedPage);
      const page = pages[labelPageIndex]!;
      const label = page.items.find((item) => item.text === '[Chorus]')!;
      const firstLine = page.items.find((item) => item.text === 'First chorus line')!;
      expect(label.x).toBeCloseTo(firstLine.x, 1);
      expect(label.y).toBeGreaterThan(firstLine.y);
      if (expectedPage === 0) {
        const prior = page.items.find((item) => item.text === 'P' + String(precedingLines).padStart(2, '0'))!;
        expect(label.x).toBeGreaterThan(prior.x);
      }
      if (expectedPage === 1) {
        expect(label.x).toBeCloseTo(15 * 72 / 25.4, 0);
        expect(label.y).toBeGreaterThan(pages[0]!.items.find((item) => item.text === 'P47')!.y);
      }
    },
  );

  it('preserves section and stanza gaps within a column without adding a leading boundary gap', async () => {
    const snapshot = await generatePdf(validSong({ size: 'A4' }, '[Verse]\nFirst stanza\n\nSecond stanza\n\n[Chorus]\nFirst chorus line'));
    const pages = await inspect(snapshot);
    const first = pages[0]!.items.find((item) => item.text === 'First stanza')!;
    const second = pages[0]!.items.find((item) => item.text === 'Second stanza')!;
    const chorus = pages[0]!.items.find((item) => item.text === '[Chorus]')!;
    expect(first.x).toBeCloseTo(second.x, 1);
    expect(second.x).toBeCloseTo(chorus.x, 1);
    expect(first.y - second.y).toBeCloseTo(24, 0);
    expect(second.y - chorus.y).toBeCloseTo(24, 0);
  });

  it('wraps a long unbroken token by grapheme without losing its content', async () => {
    const text = 'W'.repeat(1000);
    const snapshot = await generatePdf(validSong({ size: 'A6' }, text));
    const body = (await inspect(snapshot)).flatMap((page) => page.items.map((item) => item.text)).filter((value) => !['Paper Lanterns', 'The Quiet Signals', '[Verse 1]'].includes(value)).join('');
    expect(body).toBe(text);
    expect(snapshot.pageCount).toBeGreaterThan(1);
  });

  it('rejects paper geometry beyond the PDF page limit', async () => {
    const song = validSong({ size: 'A4' });
    const oversized = { ...song, paper: { ...song.paper, width: 5100, height: 297 } } as ValidatedSong;
    await expect(generatePdf(oversized)).rejects.toMatchObject({ code: 'invalid-geometry' });
  });

  it('rejects an empty forged ValidatedSong without returning a snapshot', async () => {
    const song = { ...validSong({ size: 'A4' }), lyrics: { ...validSong({ size: 'A4' }).lyrics, text: '' } } as ValidatedSong;
    await expect(generatePdf(song)).rejects.toMatchObject({ code: 'invalid-input' });
  });

  it('wraps supported long lyric lines while retaining every word in reading order', async () => {
    const line = 'Lanterns travel through the quiet valley carrying every patient promise toward the morning horizon';
    const snapshot = await generatePdf(validSong({ size: 'A6' }, line));
    const pages = await inspect(snapshot);
    const bodyItems = pages.flatMap((page) => page.items.filter((item) => item.text !== 'Paper Lanterns' && item.text !== 'The Quiet Signals'));
    expect(bodyItems.map((item) => item.text).join(' ').match(/\S+/gu)).toEqual(line.match(/\S+/gu));
    expect(new Set(bodyItems.map((item) => item.y)).size).toBeGreaterThan(1);
    expect(bodyItems.every((item) => item.x + item.width <= pages[0]!.viewport.width - 15 * 72 / 25.4 + 1)).toBe(true);
  });

  it('does not mutate the validated input or detach snapshot bytes during inspection', async () => {
    const song = validSong({ size: 'A4' }, '[Chorus]\nTogether\n\nTogether');
    const original = structuredClone(song);
    const snapshot = await generatePdf(song);
    const before = snapshot.bytes.slice();
    const exposed = snapshot.bytes;
    exposed[0] = 0;
    await inspect(snapshot);
    expect(song).toEqual(original);
    expect(snapshot.bytes).toEqual(before);
  });

  it('wraps multiline and overwide headers without clipping', async () => {
    const title = 'A title\nthat wraps ' + 'W'.repeat(50);
    const snapshot = await generatePdf(validSong({ size: 'A6' }, 'Lyric', title, 'Artist'));
    const pages = await inspect(snapshot);
    const renderedTitle = pages.flatMap((page) => page.items).filter((item) => item.text && title.includes(item.text)).map((item) => item.text).join('');
    expect(renderedTitle).toContain('A title');
    expect(renderedTitle).toContain('that wraps');
    expect(renderedTitle).toContain('W'.repeat(50));
    expect(pages[0]!.items.find((item) => item.text === 'Lyric')!.y).toBeLessThan(pages[0]!.items.find((item) => item.text.includes('Artist'))!.y);
  });

  it('exports the shared approved layout constants', () => {
    expect(PDF_LAYOUT).toMatchObject({ columnCount: 2, marginMm: 15, columnGapMm: 6, lyricsFontSizePt: 12, titleFontSizePt: 16, artistFontSizePt: 11 });
  });
});
