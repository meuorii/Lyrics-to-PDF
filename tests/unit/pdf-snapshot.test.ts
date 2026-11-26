import { describe, expect, it } from 'vitest';
import { PdfSnapshot } from '../../src/types/domain';

describe('PdfSnapshot byte ownership', () => {
  it('keeps worker-facing byte copies and the download Blob identical to its owned document', async () => {
    const source = new Uint8Array([37, 80, 68, 70, 45, 49]);
    const snapshot = new PdfSnapshot(source, 1, 'Safe song.pdf', { size: 'A4', width: 210, height: 297, unit: 'mm' }, {
      valid: true,
      issues: [],
      columnWidthPt: 240,
      usableBodyHeightPt: 700,
    });

    source.fill(0);
    const viewerBytes = snapshot.bytes;
    const blobBytes = new Uint8Array(await snapshot.blob.arrayBuffer());
    viewerBytes.fill(0);

    expect(Array.from(blobBytes)).toEqual([37, 80, 68, 70, 45, 49]);
    expect(Array.from(snapshot.bytes)).toEqual([37, 80, 68, 70, 45, 49]);
    expect(snapshot.blob.type).toBe('application/pdf');
    expect(snapshot.filename).toBe('Safe song.pdf');
  });
});
