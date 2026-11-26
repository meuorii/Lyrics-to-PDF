import { describe, expect, it } from 'vitest';
import { createPdfFilename } from '../../src/features/pdf/pdf-filename';

describe('safe PDF filename metadata', () => {
  it('uses Artist - Song Title.pdf and preserves supported Unicode', () => {
    expect(createPdfFilename({ artist: 'Björk', title: '夜の光' })).toBe('Björk - 夜の光.pdf');
  });

  it('removes path separators and invalid filename characters without changing source metadata', () => {
    const song = { artist: 'C:\\Band', title: 'Song: Part 1?.pdf.pdf' };
    expect(createPdfFilename(song)).toBe('C Band - Song Part 1.pdf');
    expect(song).toEqual({ artist: 'C:\\Band', title: 'Song: Part 1?.pdf.pdf' });
  });

  it('handles reserved device names and names that sanitize to empty', () => {
    expect(createPdfFilename({ artist: 'CON', title: 'Song' })).toBe('_CON - Song.pdf');
    expect(createPdfFilename({ artist: ' ', title: '...' })).toBe('Song.pdf');
  });

  it('trims trailing dots and spaces and caps the filename stem at 180 code points', () => {
    const filename = createPdfFilename({ artist: 'Band... ', title: '夜'.repeat(200) });
    expect(filename.startsWith('Band - ')).toBe(true);
    expect(filename.endsWith('.pdf')).toBe(true);
    expect(Array.from(filename.slice(0, -4))).toHaveLength(180);
  });
});
