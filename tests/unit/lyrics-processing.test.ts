import { describe, expect, it } from 'vitest';
import { normalizeLyrics } from '../../src/features/lyrics/normalize-lyrics';
import { parseSectionLabel, SECTION_REGISTRY } from '../../src/features/lyrics/section-labels';
import { processSongInput, validateMetadata, validateLyrics } from '../../src/features/lyrics/validate-input';

const CANONICAL_SECTIONS = [
  'Intro', 'Verse', 'Pre-Verse', 'Pre-Chorus', 'Chorus', 'Post-Chorus', 'Bridge', 'Refrain', 'Hook', 'Interlude', 'Outro', 'Coda',
  'Rap', 'Rap Verse', 'Spoken Word', 'Spoken Intro', 'Spoken Outro', 'Dialogue', 'Skit', 'Narration', 'Freestyle',
  'Instrumental', 'Instrumental Break', 'Instrumental Intro', 'Instrumental Outro', 'Solo', 'Guitar Solo', 'Piano Solo', 'Drum Solo', 'Bass Solo', 'Break', 'Breakdown', 'Dance Break', 'Build-Up', 'Drop', 'Pre-Drop', 'Post-Drop', 'Transition', 'Reprise',
  'Medley', 'Ad-Libs', 'Vocal Break', 'Vocal Solo', 'Chant', 'Choir', 'Sample', 'Call and Response', 'Vocalizing',
] as const;

describe('section labels', () => {
  it('recognizes Rap and removes a complete multi-performer annotation', () => {
    const raw = '[Rap: Artist A, Artist B, Artist C & Artist D]\nA synthetic rap line.';
    expect(parseSectionLabel('[Rap: Artist A, Artist B, Artist C & Artist D]')?.label).toBe('[Rap]');
    expect(normalizeLyrics(raw).text).toBe('[Rap]\nA synthetic rap line.');
  });

  it('recognizes the complete approved canonical section list', () => {
    expect(CANONICAL_SECTIONS).toHaveLength(48);
    expect(SECTION_REGISTRY.numbering).toBe('optional-decimal-preserved');
    expect(SECTION_REGISTRY.sections.map(({ name }) => name)).toEqual(CANONICAL_SECTIONS);
    for (const name of CANONICAL_SECTIONS) expect(parseSectionLabel(`[${name}]`)?.label).toBe(`[${name}]`);
  });

  it('accepts case-insensitive canonical names and collapses heading whitespace', () => {
    for (const name of CANONICAL_SECTIONS) expect(parseSectionLabel(`[${name.toLowerCase()}]`)?.label).toBe(`[${name}]`);
    expect(parseSectionLabel('[  pre   chorus   2 : All ]')?.label).toBe('[Pre-Chorus 2]');
  });

  it('keeps parser vocabulary unambiguous across canonical names and aliases', () => {
    const tokens = SECTION_REGISTRY.sections.flatMap(({ name, aliases }) => [name, ...aliases].map((token) => token.trim().replace(/\s+/gu, ' ').toLowerCase()));
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it.each(CANONICAL_SECTIONS)('removes performer and song annotations from %s headings', (name) => {
    expect(parseSectionLabel(`[${name}: Artist A, Artist B & Artist C]`)?.label).toBe(`[${name}]`);
    expect(parseSectionLabel(`[${name} (Song: Subtitle): Artist A & Artist B]`)?.label).toBe(`[${name}]`);
    expect(parseSectionLabel(`[${name} (Song: Subtitle)]`)?.label).toBe(`[${name}]`);
  });

  it.each(CANONICAL_SECTIONS)('preserves explicit numbering for %s', (name) => {
    expect(parseSectionLabel(`[${name} 2: Artist A]`)?.label).toBe(`[${name} 2]`);
  });

  it.each([
    ['rap', '[Rap]'], ['RAP', '[Rap]'], ['Rap Verse', '[Rap Verse]'],
    ['Pre Verse', '[Pre-Verse]'], ['Pre-Chorus', '[Pre-Chorus]'], ['Pre Chorus', '[Pre-Chorus]'],
    ['Post-Chorus', '[Post-Chorus]'], ['Post Chorus', '[Post-Chorus]'],
    ['Spoken-Word', '[Spoken Word]'], ['Spoken Word', '[Spoken Word]'],
    ['Build Up', '[Build-Up]'], ['Build-Up', '[Build-Up]'], ['Pre Drop', '[Pre-Drop]'], ['Post Drop', '[Post-Drop]'],
    ['Adlibs', '[Ad-Libs]'], ['Ad Libs', '[Ad-Libs]'], ['Ad-Libs', '[Ad-Libs]'],
    ['Call & Response', '[Call and Response]'], ['Call and Response', '[Call and Response]'],
  ])('normalizes explicit alias %s', (alias, expected) => {
    expect(parseSectionLabel(`[${alias}: Artist A]`)?.label).toBe(expected);
    expect(parseSectionLabel(`[${alias} 7: Artist A]`)?.label).toBe(expected.slice(0, -1) + ' 7]');
  });

  it.each([
    ['[Rap Verse: Artist A]', '[Rap Verse]'],
    ['[Instrumental Break: Artist A]', '[Instrumental Break]'],
    ['[Spoken Intro: Artist A]', '[Spoken Intro]'],
    ['[Post-Chorus: All]', '[Post-Chorus]'],
    ['[Guitar Solo: Musician A]', '[Guitar Solo]'],
    ['[Pre-Chorus: All]', '[Pre-Chorus]'],
    ['[Pre-Drop: DJ A]', '[Pre-Drop]'],
    ['[Breakdown: All]', '[Breakdown]'],
    ['[Instrumental Outro: All]', '[Instrumental Outro]'],
  ])('matches the longest registered section in %s', (input, expected) => {
    expect(parseSectionLabel(input)?.label).toBe(expected);
  });

  it('reports referenced-song and performer annotations as separate parsed fields', () => {
    expect(parseSectionLabel('[Rap (Song: Subtitle): Artist A]')?.annotations).toEqual(['referenced-song', 'performers']);
    expect(parseSectionLabel('[Medley: Song A; Song B]')?.annotations).toEqual(['medley-song-list']);
    expect(parseSectionLabel('[Rap: Artist A]')?.annotations).toEqual(['performers']);
  });

  it('does not treat numbers inside song or performer annotations as section numbers', () => {
    const parsed = parseSectionLabel('[Rap (Song 9: Subtitle): Artist 2]');
    expect(parsed?.label).toBe('[Rap]');
    expect(parsed?.sectionNumber).toBeNull();
  });

  it.each(['[Rap I]', '[Rap 2a]', '[Rap 1.5]', '[Rap 2: ]', '[Rap (Song):]', '[Rap: Artist] trailing', '[Rap: Artist]]'])('preserves unsupported numbering or malformed syntax %s', (input) => {
    expect(parseSectionLabel(input)).toBeNull();
  });

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
    ['  [vErSe 1: Artist]  ', '[Verse 1]'],
    ['[chorus]', '[Chorus]'],
    ['[Chorus (It\'s a New Day: Live): Artist A, Artist B]', '[Chorus]'],
    ['[Post-Chorus (Song A): Artist A]', '[Post-Chorus]'],
    ['[Bridge (Song B): Artist B]', '[Bridge]'],
    ['[Medley: Song A; Song B]', '[Medley]'],
    ['[Medley (Song A): Artist A]', '[Medley]'],
    ['[mEdLeY]', '[Medley]'],
    ['[Verse 02 (Song: Subtitle): Singer]', '[Verse 02]'],
  ])('recognizes %s as %s', (input, output) => {
    expect(parseSectionLabel(input)?.label).toBe(output);
  });

  it.each(['[Remember this: never give up]', '[Unknown section: Artist A]', 'I remember [Verse 1] from yesterday', 'She said: stay with me', '(Artist A)', '[Verse 1 extra]', '[Chorus (unfinished]', '[Chorus:]', '[Chorus (Song) extra]'])('preserves non-label text %s', (input) => {
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

  it('joins only a clearly annotated two-line section heading', () => {
    const result = normalizeLyrics('[Chorus (Song title:\nsubtitle): Singer]\n(ordinary backing vocal)\nHello');
    expect(result.text).toBe('[Chorus]\n(ordinary backing vocal)\nHello');
    expect(result.sections[0]?.label).toBe('[Chorus]');
    expect(result.sections[0]?.lines).toEqual(['(ordinary backing vocal)', 'Hello']);
    expect(normalizeLyrics(result.text).text).toBe(result.text);
  });

  it('preserves ambiguous multiline and malformed headings as source lines', () => {
    const raw = '[Chorus\nThis is lyric content]\n[Bridge (unfinished\nordinary lyric';
    expect(normalizeLyrics(raw).text).toBe(raw);
  });

  it('keeps lyric parentheses, inline brackets, and performer names in body text', () => {
    const raw = 'A lyric (oh-oh)\nArtist A: I remember the morning\nA sentence containing [Rap] inline.';
    expect(normalizeLyrics(raw).text).toBe(raw);
  });

  it('keeps standalone empty section markers distinct from the next populated section', () => {
    const result = normalizeLyrics('[Instrumental Break]\n\n[Rap]\nSynthetic rap line.');
    expect(result.sections).toEqual([
      { label: '[Instrumental Break]', lines: [] },
      { label: '[Rap]', lines: ['Synthetic rap line.'] },
    ]);
  });

  it('normalizes a performer list split across one clearly incomplete line', () => {
    const raw = '[Rap: Artist A, Artist B,\nArtist C & Artist D]\nFirst synthetic line.';
    expect(normalizeLyrics(raw).text).toBe('[Rap]\nFirst synthetic line.');
    expect(normalizeLyrics(raw).rawText).toBe(raw);
  });

  it.each([
    ['[Rap (Song: Subtitle):\nArtist A, Artist B]', '[Rap]\nFirst synthetic line.'],
    ['[Rap (Song)\n: Artist A & Artist B]', '[Rap]\nFirst synthetic line.'],
    ['[Rap (Song):\nArtist A, Artist B]', '[Rap]\nFirst synthetic line.'],
  ])('recognizes a bounded song-reference/performer continuation', (heading, expected) => {
    expect(normalizeLyrics(`${heading}\nFirst synthetic line.`).text).toBe(expected);
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
    expect(validateLyrics('[Rap: Performer A, Performer B]\n[Hook]')[0]?.message).toMatch(/lyric/i);
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
