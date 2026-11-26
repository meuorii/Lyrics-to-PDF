import type { PaperDimensions, PaperSize } from '../../types/domain';

export const DEFAULT_PAPER_SIZE: PaperSize = 'A4';

export const PAPER_SIZES = {
  A3: { width: 297, height: 420, unit: 'mm' },
  A4: { width: 210, height: 297, unit: 'mm' },
  A5: { width: 148, height: 210, unit: 'mm' },
  A6: { width: 105, height: 148, unit: 'mm' },
  B4: { width: 250, height: 353, unit: 'mm' },
  B5: { width: 176, height: 250, unit: 'mm' },
  Letter: { width: 215.9, height: 279.4, unit: 'mm' },
  'Long Bond': { width: 215.9, height: 330.2, unit: 'mm' },
  Legal: { width: 215.9, height: 355.6, unit: 'mm' },
} as const satisfies Record<Exclude<PaperSize, 'Custom'>, PaperDimensions>;
