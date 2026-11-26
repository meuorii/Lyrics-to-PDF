import { describe, expect, it } from 'vitest';
import { normalizeLyrics } from '../../src/features/lyrics/normalize-lyrics';
import { parseSectionLabel } from '../../src/features/lyrics/section-labels';
import { processSongInput, validateMetadata, validateLyrics } from '../../src/features/lyrics/validate-input';

describe('section labels', () => {
  it.each([
    ['[Intro]', '[Intro]'],
    ['[Verse 1: Nayeon, Mina]', '[Verse 1]'],
    [' [Pre-Chorus: Sana] ', '[Pre-Chorus]'],
    ['[Chorus: Jihyo, All]', '[Chorus]'],
    ['[Post-Chorus]', '[Post-Chorus]'],
    ['[Bridge: Dahyun & Tzuyu]', '[Bridge]'],
    ['[Refrain]', '[Refrain]'],
    ['[Verse: Performer 이름]', '[Verse]'],
    ['[Verse 2: Artist A / Artist B]', '[Verse 2]'],
    ['[Instrumental Break]', '[Instrumental Break]'],
    ['[Instrumental]', '[Instrumental]'],
    ['[Interlude]', '[Interlude]'],
    ['[Outro: All]', '[Outro]'],
    ['  [vErSe 1: Artist]  ', '[vErSe 1]'],
  ])('recognizes %s as %s', (input, output) => {
    expect(parseSectionLabel(input)?.label).toBe(output);
  });

  it.each(['[Remember this: never give up]', '[Unknown section: Artist A]', 'I remember [Verse 1] from yesterday', 'She said: stay with me', '(Artist A)', '[Verse 1 extra]'])('preserves non-label text %s', (input) => {
    expect(parseSectionLabel(input)).toBeNull();
  });
});

describe('lyrics normalization', () => {
  it('normalizes line endings, BOM and blank lines while preserving stanzas, repetitions and Unicode', () => {
    const result = normalizeLyrics('\uFEFF\r\n\r\nOpening\r\n\r\n\r\n[Verse 1: Nayeon]\r\n안녕\rこんにちは\r中文\rMahal, kaibigan!\rCafe\u0301\r\r\rAgain\rAgain\r\n');
    expect(result.text).toBe('Opening\n\n[Verse 1]\n안녕\nこんにちは\n中文\nMahal, kaibigan!\nCafe\u0301\n\nAgain\nAgain');
    expect(result.sections).toEqual([
      { label: null, lines: ['Opening'] },
      { label: '[Verse 1]', lines: ['안녕', 'こんにちは', '中文', 'Mahal, kaibigan!', 'Cafe\u0301', '', 'Again', 'Again'] },
    ]);
  });

  it('removes only explicit Genius URL artifact lines and preserves ambiguous words', () => {
    const result = normalizeLyrics('The lyrics share a view\nhttps://genius.com/songs/example-lyrics\nhttps://notgenius.com/song\nEmbed\nYou might also like\nContributor\nSee you\nVerse ends 42');
    expect(result.text).toBe('The lyrics share a view\nhttps://notgenius.com/song\nEmbed\nYou might also like\nContributor\nSee you\nVerse ends 42');
    expect(result.warnings).toEqual([{ code: 'genius-artifact-removed', line: 'https://genius.com/songs/example-lyrics' }]);
  });

  it('is idempotent and does not modify its input', () => {
    const raw = '[Chorus: Artist A]\r\nTogether\r\n\r\nTogether';
    const first = normalizeLyrics(raw);
    expect(normalizeLyrics(first.text).text).toBe(first.text);
    expect(raw).toBe('[Chorus: Artist A]\r\nTogether\r\n\r\nTogether');
  });
});

describe('lyrics validation and unified processing', () => {
  it('preserves metadata and accepts mixed-language values', () => {
    expect(validateMetadata({ title: '  夜 / Night  ', artist: '김민지 & Alex' })).toEqual([]);
  });

  it('reports title, artist and lyrics errors without throwing', () => {
    expect(validateMetadata({ title: '\u200B\u2060', artist: '  ' })).toHaveLength(2);
    expect(validateLyrics('https://genius.com/songs/example-lyrics')).toHaveLength(1);
    expect(validateLyrics('[Verse 1]\n[Chorus]')[0]?.message).toMatch(/lyric/i);
    expect(validateLyrics('[Remember this: keep going]')).toEqual([]);
  });

  it('returns generation-ready normalized data only when all fields and paper are valid', () => {
    const valid = processSongInput({ title: '  夜 / Night  ', artist: '김민지 & Alex', rawLyrics: '[Verse 1: Artist]\nHello', paper: { size: 'A4' } });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.lyrics.text).toBe('[Verse 1]\nHello');
      expect(valid.data.song.title).toBe('  夜 / Night  ');
      expect(valid.data.song.artist).toBe('김민지 & Alex');
      expect(valid.data.rawLyrics.rawText).toBe('[Verse 1: Artist]\nHello');
      expect(valid.data.paper).toMatchObject({ size: 'A4', width: 210, height: 297, unit: 'mm' });
    }
    const invalid = processSongInput({ title: '', artist: 'Artist', rawLyrics: '  ', paper: { size: 'A4' } });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.issues.map((issue) => issue.field)).toEqual(['title', 'lyrics']);
    const multiple = processSongInput({ title: ' ', artist: '\u2060', rawLyrics: 'https://genius.com/songs/chrome', paper: { size: 'Custom', custom: { width: 10, height: 20, unit: 'mm' } } });
    expect(multiple.success).toBe(false);
    if (!multiple.success) expect(new Set(multiple.issues.map((issue) => issue.field))).toEqual(new Set(['title', 'artist', 'lyrics', 'paper']));
  });
});
