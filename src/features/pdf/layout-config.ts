import type { PdfLayoutConfig } from '../../types/domain';

export const millimetersToPoints = (millimeters: number): number =>
  (millimeters * 72) / 25.4;

export const PDF_LAYOUT = {
  paperSize: 'A4',
  orientation: 'portrait',
  marginMm: 15,
  columnGapMm: 6,
  columnCount: 2,
  titleFontSizePt: 16,
  artistFontSizePt: 11,
  lyricsFontSizePt: 12,
  sectionLabelFontSizePt: 12,
  lineHeight: 1,
  paragraphSpacingPt: 0,
  sectionSeparationBlankLines: 1,
  fontFamily: 'Roboto',
  textColor: '#000000',
  backgroundColor: '#FFFFFF',
} satisfies PdfLayoutConfig;

export const PDF_HEADER_BODY_GAP_PT = 12;
export const PDF_HEADER_RESERVED_HEIGHT_PT = 34;
