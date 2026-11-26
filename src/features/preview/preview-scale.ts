export type ZoomDirection = 'in' | 'out';
export type FitMode = 'page' | 'width';
export type CanvasResolution = { width: number; height: number; outputScale: number };

export const PDF_REFERENCE_SCALE = 96 / 72;
export const MIN_ZOOM_PERCENT = 50;
export const MAX_ZOOM_PERCENT = 200;
export const ZOOM_STEP_PERCENT = 25;
export const MAX_CANVAS_PIXELS = 16_000_000;
export const MAX_CANVAS_DIMENSION = 8192;

export function getZoomPercent(scale: number): number {
  return Math.round((scale / PDF_REFERENCE_SCALE) * 100);
}

export function canZoom(scale: number, direction: ZoomDirection): boolean {
  const percent = (scale / PDF_REFERENCE_SCALE) * 100;
  return direction === 'in' ? percent < MAX_ZOOM_PERCENT : percent > MIN_ZOOM_PERCENT;
}

export function manualZoomScale(scale: number, direction: ZoomDirection): number {
  const currentPercent = (scale / PDF_REFERENCE_SCALE) * 100;
  const stepIndex = direction === 'in'
    ? Math.floor(currentPercent / ZOOM_STEP_PERCENT) + 1
    : Math.ceil(currentPercent / ZOOM_STEP_PERCENT) - 1;
  const percent = Math.max(MIN_ZOOM_PERCENT, Math.min(MAX_ZOOM_PERCENT, stepIndex * ZOOM_STEP_PERCENT));
  return (percent / 100) * PDF_REFERENCE_SCALE;
}

export function fitScale(
  pageWidth: number,
  pageHeight: number,
  availableWidth: number,
  availableHeight: number,
  mode: FitMode,
): number | null {
  if (![pageWidth, pageHeight, availableWidth, availableHeight].every((value) => Number.isFinite(value) && value > 0)) return null;
  const widthScale = availableWidth / pageWidth;
  return mode === 'width' ? widthScale : Math.min(widthScale, availableHeight / pageHeight);
}

export function calculateCanvasResolution(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): CanvasResolution | null {
  if (![cssWidth, cssHeight, devicePixelRatio].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(
    devicePixelRatio,
    Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight)),
    MAX_CANVAS_DIMENSION / cssWidth,
    MAX_CANVAS_DIMENSION / cssHeight,
  );
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    width: Math.max(1, Math.floor(cssWidth * scale)),
    height: Math.max(1, Math.floor(cssHeight * scale)),
    outputScale: scale,
  };
}
