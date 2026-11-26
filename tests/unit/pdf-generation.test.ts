import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { generatePdf } from '../../src/features/pdf/generate-pdf';
import { PDF_LAYOUT } from '../../src/features/pdf/layout-config';
import { processSongInput } from '../../src/features/lyrics/validate-input';
import { normalizeLyrics } from '../../src/features/lyrics/normalize-lyrics';
import { SECTION_REGISTRY } from '../../src/features/lyrics/section-labels';
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

  it('generates a 3,502-character section-rich Legal lyric sheet without losing ordered markers', async () => {
    const lines: string[] = [];
    const markers: string[] = [];
    for (let section = 1; section <= 4; section += 1) {
      lines.push(`[Verse ${section}: Sarah, Bamboo & Lea]`);
      for (let line = 0; line < 30; line += 1) {
        const marker = `FAMILY-${String(markers.length + 1).padStart(3, '0')}`;
        markers.push(marker);
        lines.push(`${marker}: We’ll stay.`);
        if (line % 5 === 4) lines.push('');
      }
      lines.push('[Chorus: All]', 'Forever, forever, family is forever.', 'Forever, forever, family is forever.');
    }
    let rawLyrics = lines.join('\n');
    while (rawLyrics.length < 3_400) {
      const marker = `FAMILY-${String(markers.length + 1).padStart(3, '0')}`;
      const line = `${marker}: We’ll stay.`;
      lines.push(line);
      markers.push(marker);
      rawLyrics = lines.join('\n');
    }
    const remaining = 3_502 - rawLyrics.length;
    lines.push(`PASTE-${'x'.repeat(remaining - 7)}`);
    rawLyrics = lines.join('\n');

    expect(rawLyrics).toHaveLength(3_502);
    const snapshot = await generatePdf(validSong({ size: 'Legal' }, rawLyrics, 'Family Is Forever', 'ABS-CBN Music All Star'));
    const pages = await inspect(snapshot);
    const body = pages.flatMap((page) => page.items.map((item) => item.text)).join('');
    const foundMarkers = body.match(/FAMILY-\d{3}/gu) ?? [];

    expect(snapshot.pageCount).toBe(pages.length);
    expect(pages.length).toBeGreaterThan(1);
    expect(foundMarkers).toEqual(markers);
    expect(body).toContain('[Verse 1]');
    expect(body).toContain('[Chorus]');
    expect(body).toContain('ABS-CBN Music All Star');
    expect(body).toContain('Family Is Forever');
  });

  it('keeps anonymized near-boundary Legal lines within the measured page count', async () => {
    const lyrics = await readFile(join(process.cwd(), 'tests/fixtures/legal-near-boundary-width-profile.txt'), 'utf8');
    const snapshot = await generatePdf(validSong({ size: 'Legal' }, lyrics, 'Family Is Forever', 'ABS-CBN Music All Star'));
    const pages = await inspect(snapshot);

    expect(snapshot.pageCount).toBe(1);
    expect(pages).toHaveLength(snapshot.pageCount);
    expect(pages.flatMap((page) => page.items.map((item) => item.text))).toContain('Family Is Forever');
  });

  it('renders annotated Chorus and Medley labels canonically without dropping synthetic lyric text', async () => {
    const raw = '[chorus (Song: subtitle): Singer A, Singer B]\nA synthetic lyric.\n[medley: Song A; Song B]\nAnother synthetic lyric.';
    const snapshot = await generatePdf(validSong({ size: 'Legal' }, raw));
    const pages = await inspect(snapshot);
    const body = pages.flatMap((page) => page.items.map((item) => item.text)).filter((text) => !['Paper Lanterns', 'The Quiet Signals'].includes(text)).join('');

    expect(snapshot.pageCount).toBe(1);
    expect(body).toContain('[Chorus]');
    expect(body).toContain('[Medley]');
    expect(body).toContain('A synthetic lyric.');
    expect(body).toContain('Another synthetic lyric.');
    expect(body).not.toContain('Singer A');
    expect(body).not.toContain('Song A');
  });

  it('generates and extracts every registered section with annotations removed and lyrics intact', async () => {
    const songTitle = 'Synthetic Registry Title';
    const songArtist = 'Synthetic Registry Artist';
    const raw = SECTION_REGISTRY.sections.map(({ name }, index) => `[${name} 2 (Referenced Song: Subtitle): Performer A, Performer B & Performer C]\nRegistry marker ${index + 1}`).join('\n\n');
    const normalized = normalizeLyrics(raw);
    const snapshot = await generatePdf(validSong({ size: 'Long Bond' }, raw, songTitle, songArtist));
    const pages = await inspect(snapshot);
    const allItems = pages.flatMap((page) => page.items);
    const body = allItems.filter((item) => item.text !== songTitle && item.text !== songArtist).map((item) => item.text).join('').replace(/\s+/gu, '').normalize('NFC');
    const expected = normalized.text.replace(/\s+/gu, '').normalize('NFC');

    expect(SECTION_REGISTRY.sections).toHaveLength(48);
    expect(snapshot.paper).toMatchObject({ size: 'Long Bond', width: 215.9, height: 330.2 });
    expect(snapshot.pageCount).toBe(pages.length);
    expect(normalized.rawText).toBe(raw);
    expect(snapshot.blob.type).toBe('application/pdf');
    expect(new Uint8Array(await snapshot.blob.arrayBuffer())).toEqual(snapshot.bytes);
    expect(allItems.map((item) => item.text)).toContain(songTitle);
    expect(allItems.map((item) => item.text)).toContain(songArtist);
    expect(body).toBe(expected);
    expect(body).not.toContain('Performer');
    expect(body).not.toContain('ReferencedSong');

    SECTION_REGISTRY.sections.forEach(({ name }, index) => {
      const heading = `[${name} 2]`;
      const marker = `Registry marker ${index + 1}`;
      const pageIndex = pages.findIndex((page) => page.items.some((item) => item.text === heading));
      const markerPageIndex = pages.findIndex((page) => page.items.some((item) => item.text === marker));
      expect(pageIndex).toBeGreaterThanOrEqual(0);
      expect(markerPageIndex).toBe(pageIndex);
      const headingItem = pages[pageIndex]!.items.find((item) => item.text === heading)!;
      const firstLineItem = pages[pageIndex]!.items.find((item) => item.text === marker)!;
      expect(headingItem.x).toBeCloseTo(firstLineItem.x, 1);
      expect(headingItem.y).toBeGreaterThan(firstLineItem.y);
    });
  }, 30_000);

  it('keeps a standalone Instrumental Break separate from the following section in the PDF', async () => {
    const raw = '[Instrumental Break]\n\n[Rap]\nFollowing section lyric.';
    const snapshot = await generatePdf(validSong({ size: 'A4' }, raw));
    const items = (await inspect(snapshot))[0]!.items;
    const texts = items.map((item) => item.text);

    expect(texts.indexOf('[Instrumental Break]')).toBeGreaterThanOrEqual(0);
    expect(texts.indexOf('[Rap]')).toBeGreaterThan(texts.indexOf('[Instrumental Break]'));
    expect(texts.indexOf('Following section lyric.')).toBeGreaterThan(texts.indexOf('[Rap]'));
  });

  it.each(['Rap', 'Hook'])('lets long %s content continue naturally across pages', async (sectionName) => {
    const lines = Array.from({ length: 110 }, (_, index) => `FLOW${String(index + 1).padStart(3, '0')}`);
    const snapshot = await generatePdf(validSong({ size: 'A6' }, `[${sectionName}: Performer A]\n${lines.join('\n')}`));
    const pages = await inspect(snapshot);
    const body = pages.flatMap((page) => page.items.map((item) => item.text));
    const extracted = body.join('');

    expect(snapshot.pageCount).toBeGreaterThan(1);
    expect(body.filter((text) => text === `[${sectionName}]`)).toHaveLength(1);
    expect(lines.every((line) => extracted.includes(line))).toBe(true);
    const markerPositions = lines.map((line) => extracted.indexOf(line));
    expect(markerPositions.every((position, index) => position >= 0 && (index === 0 || position > markerPositions[index - 1]!))).toBe(true);
    expect(body).not.toContain('Performer A');
    const headingPage = pages.findIndex((page) => page.items.some((item) => item.text === `[${sectionName}]`));
    const firstLine = pages[headingPage]!.items.find((item) => item.text === 'FLOW001')!;
    expect(firstLine).toBeDefined();
    expect(pages[headingPage]!.items.find((item) => item.text === `[${sectionName}]`)!.x).toBeCloseTo(firstLine.x, 1);
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
    expect(label.y).toBeGreaterThan(firstLine.y);
    const orderedItems = pages.flatMap((page) => page.items);
    expect(orderedItems.findIndex((item) => item.text === 'Previous 22')).toBeLessThan(orderedItems.findIndex((item) => item.text === '[Chorus]'));
  });

  it.each([23, 47])(
    'keeps the section start together at a real column/page boundary after $precedingLines lyric lines',
    async (precedingLines) => {
      const before = Array.from({ length: precedingLines }, (_, index) => 'P' + String(index + 1).padStart(2, '0')).join('\n');
      const snapshot = await generatePdf(validSong({ size: 'A6' }, before + '\n\n[Chorus]\nFirst chorus line'));
      const pages = await inspect(snapshot);
      const labelPageIndex = pages.findIndex((page) => page.items.some((item) => item.text === '[Chorus]'));
      const firstLinePageIndex = pages.findIndex((page) => page.items.some((item) => item.text === 'First chorus line'));
      expect(snapshot.pageCount).toBe(pages.length);
      expect(labelPageIndex).toBeGreaterThanOrEqual(0);
      expect(labelPageIndex).toBe(firstLinePageIndex);
      const page = pages[labelPageIndex]!;
      const label = page.items.find((item) => item.text === '[Chorus]')!;
      const firstLine = page.items.find((item) => item.text === 'First chorus line')!;
      expect(label.x).toBeCloseTo(firstLine.x, 1);
      expect(label.y).toBeGreaterThan(firstLine.y);
      const orderedItems = pages.flatMap((currentPage) => currentPage.items);
      const priorIndex = orderedItems.findIndex((item) => item.text === 'P' + String(precedingLines).padStart(2, '0'));
      const labelIndex = orderedItems.findIndex((item) => item.text === '[Chorus]');
      expect(priorIndex).toBeGreaterThanOrEqual(0);
      expect(labelIndex).toBeGreaterThan(priorIndex);
    },
  );

  it.each([
    { precedingLines: 23, sourceHeading: '[Rap: Performer A, Performer B & Performer C]', canonicalHeading: '[Rap]' },
    { precedingLines: 47, sourceHeading: '[Rap Verse 2: Performer A, Performer B]', canonicalHeading: '[Rap Verse 2]' },
  ])('keeps $canonicalHeading with its first lyric at a real column or page boundary', async ({ precedingLines, sourceHeading, canonicalHeading }) => {
    const before = Array.from({ length: precedingLines }, (_, index) => `RP${String(index + 1).padStart(2, '0')}`).join('\n');
    const raw = `${before}\n\n${sourceHeading}\nUnique first rap line.\nUnique continuing rap line.`;
    const snapshot = await generatePdf(validSong({ size: 'A6' }, raw));
    const pages = await inspect(snapshot);
    const headingPage = pages.findIndex((page) => page.items.some((item) => item.text === canonicalHeading));
    const firstLinePage = pages.findIndex((page) => page.items.map((item) => item.text).join('').replace(/\s+/gu, '').includes('Uniquefirstrapline.'));
    const lastPriorPage = pages.findIndex((page) => page.items.some((item) => item.text === `RP${String(precedingLines).padStart(2, '0')}`));

    expect(snapshot.pageCount).toBe(pages.length);
    expect(headingPage).toBe(firstLinePage);
    expect(headingPage).toBeGreaterThanOrEqual(lastPriorPage);
    if (precedingLines === 47) expect(headingPage).toBeGreaterThan(0);
    const page = pages[headingPage]!;
    const heading = page.items.find((item) => item.text === canonicalHeading)!;
    const firstLine = page.items.find((item) => item.text.startsWith('Unique first rap'))!;
    expect(heading.x).toBeCloseTo(firstLine.x, 1);
    expect(heading.y).toBeGreaterThan(firstLine.y);
    if (precedingLines === 23) expect(heading.x).toBeGreaterThan(page.viewport.width / 2);
    if (precedingLines === 47) expect(heading.x).toBeLessThan(page.viewport.width / 2);
    expect(page.items.map((item) => item.text)).not.toContain('Performer A');
    const extracted = pages.flatMap((current) => current.items.map((item) => item.text)).join('').replace(/\s+/gu, '');
    expect(extracted).toContain('Uniquecontinuingrapline.');
  });

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
