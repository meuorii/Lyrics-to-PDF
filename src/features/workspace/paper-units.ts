import type { MeasurementUnit } from '../../types/domain';

function toMillimeters(value: number, unit: MeasurementUnit): number {
  return unit === 'in' ? value * 25.4 : value;
}

function fromMillimeters(value: number, unit: MeasurementUnit): number {
  return unit === 'in' ? value / 25.4 : value;
}

export function parseDimensionMillimeters(rawValue: string, unit: MeasurementUnit): number | null {
  if (rawValue.trim() === '') return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) return null;
  return toMillimeters(value, unit);
}

export function formatMillimetersInUnit(valueMm: number, unit: MeasurementUnit): string {
  return Number(fromMillimeters(valueMm, unit).toFixed(4)).toString();
}

export function convertDimensionUnit(rawValue: string, from: MeasurementUnit, to: MeasurementUnit): string {
  if (from === to || rawValue.trim() === '') return rawValue;
  const valueMm = parseDimensionMillimeters(rawValue, from);
  return valueMm === null ? rawValue : formatMillimetersInUnit(valueMm, to);
}
