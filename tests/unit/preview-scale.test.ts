import { describe, expect, it } from 'vitest';
import {
  calculateCanvasResolution,
  canZoom,
  fitScale,
  getZoomPercent,
  manualZoomScale,
  PDF_REFERENCE_SCALE,
} from '../../src/features/preview/preview-scale';

describe('PDF preview scaling', () => {
  it('uses the standard 96 CSS pixels per 72 PDF points at 100 percent', () => {
    expect(getZoomPercent(PDF_REFERENCE_SCALE)).toBe(100);
  });

  it('steps into manual zoom from fit without making zoom-in smaller', () => {
    expect(getZoomPercent(manualZoomScale(PDF_REFERENCE_SCALE * 0.4, 'in'))).toBe(50);
    expect(getZoomPercent(manualZoomScale(PDF_REFERENCE_SCALE * 0.8, 'in'))).toBe(100);
  });

  it('keeps manual zoom within 50 to 200 percent', () => {
    expect(getZoomPercent(manualZoomScale(PDF_REFERENCE_SCALE * 0.5, 'out'))).toBe(50);
    expect(getZoomPercent(manualZoomScale(PDF_REFERENCE_SCALE * 2, 'in'))).toBe(200);
    expect(canZoom(PDF_REFERENCE_SCALE * 0.5, 'out')).toBe(false);
    expect(canZoom(PDF_REFERENCE_SCALE * 2, 'in')).toBe(false);
  });

  it('fits the full page or its width using the available CSS viewport', () => {
    expect(fitScale(595, 842, 400, 500, 'page')).toBeCloseTo(500 / 842, 5);
    expect(fitScale(595, 842, 400, 500, 'width')).toBeCloseTo(400 / 595, 5);
  });

  it('rejects unavailable geometry rather than producing an infinite scale', () => {
    expect(fitScale(0, 842, 400, 500, 'page')).toBeNull();
    expect(fitScale(595, 842, 400, 0, 'page')).toBeNull();
    expect(calculateCanvasResolution(0, 842, 2)).toBeNull();
  });

  it('bounds high-DPI canvas allocation by both pixel count and dimension', () => {
    const resolution = calculateCanvasResolution(19_200, 38_400, 3);
    expect(resolution).not.toBeNull();
    expect(resolution!.width).toBeLessThanOrEqual(8192);
    expect(resolution!.height).toBeLessThanOrEqual(8192);
    expect(resolution!.width * resolution!.height).toBeLessThanOrEqual(16_000_000);
    expect(resolution!.outputScale).toBeLessThan(3);
  });
});
