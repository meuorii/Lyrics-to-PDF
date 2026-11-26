import type { PaperDimensions, PaperGeometry, PaperSelection, ResolvedPaperDimensions, ValidationIssue } from '../../types/domain';
import { millimetersToPoints, PDF_HEADER_BODY_GAP_PT, PDF_HEADER_RESERVED_HEIGHT_PT, PDF_LAYOUT } from '../pdf/layout-config';
import { PAPER_SIZES } from './paper-sizes';

export const inchesToMillimeters = (inches: number): number => inches * 25.4;
export const millimetersToInches = (millimeters: number): number => millimeters / 25.4;
export const inchesToPoints = (inches: number): number => inches * 72;
export const pointsToMillimeters = (points: number): number => (points * 25.4) / 72;
export const pointsToInches = (points: number): number => points / 72;
export { millimetersToPoints };

export type PaperResolution =
  | { ok: true; dimensions: ResolvedPaperDimensions }
  | { ok: false; issues: ValidationIssue[] };

export function validatePaperGeometry(dimensions: PaperDimensions): PaperGeometry {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(dimensions.width) || dimensions.width <= 0 || !Number.isFinite(dimensions.height) || dimensions.height <= 0) {
    issues.push({ field: 'paper', message: 'Paper dimensions must be finite positive numbers.' });
    return { valid: false, issues, columnWidthPt: 0, usableBodyHeightPt: 0 };
  }
  const widthPt = millimetersToPoints(dimensions.width);
  const heightPt = millimetersToPoints(dimensions.height);
  const marginPt = millimetersToPoints(PDF_LAYOUT.marginMm);
  const gapPt = millimetersToPoints(PDF_LAYOUT.columnGapMm);
  const columnWidthPt = (widthPt - marginPt * 2 - gapPt) / 2;
  const usableBodyHeightPt = heightPt - marginPt * 2 - PDF_HEADER_RESERVED_HEIGHT_PT - PDF_HEADER_BODY_GAP_PT;
  if (!(columnWidthPt > 0)) issues.push({ field: 'paper', message: 'Paper width is too small for the margins and two-column layout.' });
  if (!(usableBodyHeightPt > 0)) issues.push({ field: 'paper', message: 'Paper height is too small for the margins and header.' });
  return { valid: issues.length === 0, issues, columnWidthPt, usableBodyHeightPt };
}

export function resolvePaperDimensions(selection: PaperSelection): PaperResolution {
  if (selection.size !== 'Custom') {
    const preset = PAPER_SIZES[selection.size];
    return { ok: true, dimensions: { ...preset, size: selection.size } };
  }
  const custom = selection.custom;
  const issues: ValidationIssue[] = [];
  if (custom?.unit !== 'mm' && custom?.unit !== 'in') issues.push({ field: 'paper', message: 'Choose millimeters or inches for custom paper dimensions.' });
  for (const dimension of ['width', 'height'] as const) {
    const value = custom?.[dimension];
    if (value === undefined || value === null) issues.push({ field: 'paper', message: `Enter a custom paper ${dimension}.` });
    else if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) issues.push({ field: 'paper', message: `Paper ${dimension} must be a finite positive number.` });
  }
  if (issues.length) return { ok: false, issues };
  const convert = custom!.unit === 'in' ? inchesToMillimeters : (value: number) => value;
  const dimensions = { width: convert(custom!.width!), height: convert(custom!.height!), unit: 'mm' as const };
  if (dimensions.width >= dimensions.height) issues.push({ field: 'paper', message: 'Custom paper dimensions must be portrait (height greater than width).' });
  issues.push(...validatePaperGeometry(dimensions).issues);
  if (issues.length) return { ok: false, issues };
  return { ok: true, dimensions: { ...dimensions, size: 'Custom' } };
}
