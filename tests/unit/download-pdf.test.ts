import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadPdf } from '../../src/features/preview/download-pdf';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('downloadPdf', () => {
  it('hands the existing PDF Blob and safe filename to a temporary download link, then revokes its URL', () => {
    vi.useFakeTimers();
    const blob = new Blob(['%PDF-1.7\nfixture'], { type: 'application/pdf' });
    const createObjectURL = vi.fn(() => 'blob:lyrics-pdf-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });

    downloadPdf({ blob, filename: 'Artist - Safe song.pdf' });

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toBe('Artist - Safe song.pdf');
    expect(clicked[0]!.href).toBe('blob:lyrics-pdf-test');
    expect(document.body.contains(clicked[0]!)).toBe(false);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:lyrics-pdf-test');
  });
});
