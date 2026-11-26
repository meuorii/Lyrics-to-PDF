import { describe, expect, it } from 'vitest';
import { paginateLayout, type PaginationItem } from '../../src/features/pdf/pagination';
import type { MeasuredTextLine } from '../../src/features/pdf/text-layout';
import type { ResolvedFontRun } from '../../src/features/pdf/font-fallback';

function line(text: string, heightPt = 10): MeasuredTextLine {
  const face = { layout: (value: string) => ({ advanceWidth: value.length, bbox: { minX: 0, minY: 0, maxX: value.length, maxY: 1 } }), unitsPerEm: 1 } as unknown as ResolvedFontRun['face'];
  return { runs: [{ text, font: 'test', face, bold: false }], widthPt: text.length, heightPt };
}

function rowText(items: PaginationItem[]) {
  return items.map((item) => item.kind === 'line' ? item.line.runs.map((run) => run.text).join('') :
    item.kind === 'section' ? [...item.label, item.firstLine].filter((line): line is MeasuredTextLine => Boolean(line)).map((line) => line.runs.map((run) => run.text).join('')).join('|') : '').join('|');
}

describe('continuous PDF pagination', () => {
  it('fills left then right then the next page, and consumes an exact fit before advancing', () => {
    const result = paginateLayout(Array.from({ length: 5 }, (_, index) => ({ kind: 'line', line: line(String(index + 1)) } as const)), 20, 2);
    expect(result).toHaveLength(2);
    expect(rowText(result[0]!.columns[0].items)).toBe('1|2');
    expect(rowText(result[0]!.columns[1].items)).toBe('3|4');
    expect(rowText(result[1]!.columns[0].items)).toBe('5');
    expect(result[1]!.columns[1].items).toHaveLength(0);
  });

  it('moves a section label and first lyric line together and suppresses a separator at the boundary', () => {
    const items: PaginationItem[] = [
      { kind: 'line', line: line('previous', 15) },
      { kind: 'section', label: [line('[Chorus]', 5)], firstLine: line('first', 5), separationPt: 5 },
      { kind: 'line', line: line('second', 10) },
    ];
    const result = paginateLayout(items, 20, 2);
    expect(rowText(result[0]!.columns[0].items)).toBe('previous');
    expect(rowText(result[0]!.columns[1].items)).toBe('[Chorus]|first|second');
    expect(result[0]!.columns[1].items.some((item) => item.kind === 'blank')).toBe(false);
  });

  it('preserves internal stanza spacing and drops a separator that would be stranded at the boundary', () => {
    const result = paginateLayout([
      { kind: 'line', line: line('one', 10) },
      { kind: 'blank', heightPt: 5 },
      { kind: 'line', line: line('two', 10) },
      { kind: 'blank', heightPt: 5 },
      { kind: 'line', line: line('three', 10) },
    ], 25, 2);
    expect(rowText(result[0]!.columns[0].items)).toBe('one||two');
    expect(rowText(result[0]!.columns[1].items)).toBe('three');
  });

  it('fails safely when a required section group cannot fit an empty column', () => {
    expect(() => paginateLayout([
      { kind: 'section', label: [line('[Bridge]', 10)], firstLine: line('first', 15), separationPt: 5 },
    ], 20, 2)).toThrow(RangeError);
  });
});
