import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPdfFonts } from '../../src/features/pdf/font-registry';

function localFontFetch(failFilename?: string) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const filename = url.pathname.split('/').at(-1)!;
    if (filename === failFilename) return new Response('', { status: 404 });
    const bytes = await readFile(join(process.cwd(), 'public/fonts/pdf', filename));
    return new Response(bytes);
  });
}

describe('on-demand PDF font registry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads only requested language faces, deduplicates concurrent loads, and reuses parsed metrics', async () => {
    const fetchMock = localFontFetch();
    vi.stubGlobal('fetch', fetchMock);
    const [first, concurrent] = await Promise.all([loadPdfFonts(['jp']), loadPdfFonts(['jp'])]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.jp?.regular.hasGlyphForCodePoint('日'.codePointAt(0)!)).toBe(true);
    expect(first.jp?.bold.hasGlyphForCodePoint('日'.codePointAt(0)!)).toBe(true);
    expect(first.jp?.regular.familyName).toContain('Noto Sans JP');
    expect(concurrent.jp?.regular).toBe(first.jp?.regular);
    await loadPdfFonts(['jp']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not fetch CJK assets for Latin-only generation', async () => {
    const fetchMock = localFontFetch();
    vi.stubGlobal('fetch', fetchMock);
    const fonts = await loadPdfFonts([]);
    expect(fonts.latin.regular.hasGlyphForCodePoint('é'.codePointAt(0)!)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fonts.jp).toBeUndefined();
  });

  it('clears failed load promises so a later generation can recover', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const filename = url.pathname.split('/').at(-1)!;
      if (fetchMock.mock.calls.length === 1) return new Response('', { status: 404 });
      const bytes = await readFile(join(process.cwd(), 'public/fonts/pdf', filename));
      return new Response(bytes);
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadPdfFonts(['kr'])).rejects.toThrow();
    const fonts = await loadPdfFonts(['kr']);
    expect(fonts.kr?.regular.hasGlyphForCodePoint('한'.codePointAt(0)!)).toBe(true);
  });
});
