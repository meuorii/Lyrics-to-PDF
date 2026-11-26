import { describe, expect, it } from 'vitest';
import type { PaperSelection } from '../../src/types/domain';
import { PAPER_SIZES, DEFAULT_PAPER_SIZE } from '../../src/features/paper/paper-sizes';
import { inchesToMillimeters, inchesToPoints, millimetersToInches, millimetersToPoints, pointsToInches, pointsToMillimeters, resolvePaperDimensions, validatePaperGeometry } from '../../src/features/paper/paper-dimensions';

describe('paper presets and measurements', () => {
  it('defines every approved portrait preset with A4 default', () => {
    expect(DEFAULT_PAPER_SIZE).toBe('A4');
    expect(PAPER_SIZES).toMatchObject({ A3: { width: 297, height: 420 }, A4: { width: 210, height: 297 }, A5: { width: 148, height: 210 }, A6: { width: 105, height: 148 }, B4: { width: 250, height: 353 }, B5: { width: 176, height: 250 }, Letter: { width: 215.9, height: 279.4 }, 'Long Bond': { width: 215.9, height: 330.2 }, Legal: { width: 215.9, height: 355.6 } });
    for (const size of Object.keys(PAPER_SIZES) as Array<keyof typeof PAPER_SIZES>) expect(validatePaperGeometry(PAPER_SIZES[size]).valid).toBe(true);
  });

  it('converts units without rounding', () => {
    expect(millimetersToPoints(25.4)).toBe(72);
    expect(pointsToMillimeters(72)).toBe(25.4);
    expect(inchesToMillimeters(8.5)).toBeCloseTo(215.9, 12);
    expect(millimetersToInches(25.4)).toBe(1);
    expect(inchesToPoints(1)).toBe(72);
    expect(pointsToInches(72)).toBe(1);
  });

  it('resolves custom millimeter and inch dimensions and rejects unusable values', () => {
    const inches = resolvePaperDimensions({ size: 'Custom', custom: { width: 8.5, height: 11, unit: 'in' } });
    expect(inches.ok).toBe(true);
    if (inches.ok) {
      expect(inches.dimensions.width).toBeCloseTo(215.9, 12);
      expect(inches.dimensions.height).toBeCloseTo(279.4, 12);
    }
    expect(resolvePaperDimensions({ size: 'Custom', custom: { width: 210, height: 297, unit: 'mm' } }).ok).toBe(true);
    const invalidSelections: PaperSelection[] = [
      { size: 'Custom' },
      { size: 'Custom', custom: { width: 210, unit: 'mm' } },
      { size: 'Custom', custom: { height: 297, unit: 'mm' } },
      { size: 'Custom', custom: { width: 0, height: 297, unit: 'mm' } },
      { size: 'Custom', custom: { width: -1, height: 297, unit: 'mm' } },
      { size: 'Custom', custom: { width: NaN, height: 297, unit: 'mm' } },
      { size: 'Custom', custom: { width: Infinity, height: 297, unit: 'mm' } },
      { size: 'Custom', custom: { width: -Infinity, height: 297, unit: 'mm' } },
      { size: 'Custom', custom: { width: 300, height: 200, unit: 'mm' } },
      { size: 'Custom', custom: { width: 10, height: 20, unit: 'mm' } },
      { size: 'Custom', custom: { width: 210, height: 297, unit: 'cm' } } as unknown as PaperSelection,
      { size: 'Custom', custom: { width: '210', height: 297, unit: 'mm' } } as unknown as PaperSelection,
    ];
    for (const selection of invalidSelections) expect(resolvePaperDimensions(selection).ok).toBe(false);
  });

  it('rejects geometry with insufficient columns or body height', () => {
    expect(validatePaperGeometry({ width: 35, height: 297, unit: 'mm' }).valid).toBe(false);
    expect(validatePaperGeometry({ width: 210, height: 45, unit: 'mm' }).valid).toBe(false);
    expect(validatePaperGeometry({ width: NaN, height: 297, unit: 'mm' }).valid).toBe(false);
    expect(validatePaperGeometry({ width: 210, height: 297, unit: 'mm' }).columnWidthPt).toBeCloseTo((210 - 30 - 6) * 72 / 25.4 / 2);
  });
});
