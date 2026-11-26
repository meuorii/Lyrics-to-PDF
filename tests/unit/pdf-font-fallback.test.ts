import { describe, expect, it } from 'vitest';
import { getFontRunsForText, segmentGraphemes } from '../../src/features/pdf/font-fallback';

describe('PDF font script selection', () => {
  it('selects regional faces from explicit script evidence and has deterministic Han-only policy', () => {
    expect(getFontRunsForText('English 한국어 日本語かな 简体中文 繁體中文 漢字')).toEqual([
      { text: 'English', script: 'latin' },
      { text: ' 한국어', script: 'kr' },
      { text: ' 日本語かな', script: 'jp' },
      { text: ' 简体中文', script: 'sc' },
      { text: ' 繁體中文', script: 'tc' },
      { text: ' 漢字', script: 'jp' },
    ]);
  });

  it('keeps combining sequences and supplementary characters in whole grapheme clusters', () => {
    expect(segmentGraphemes('Cafe\u0301 𠀀')).toEqual(['C', 'a', 'f', 'e\u0301', ' ', '𠀀']);
  });
});
