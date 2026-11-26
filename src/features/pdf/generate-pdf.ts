import pdfMake from 'pdfmake/build/pdfmake.js';
import type { ContentColumns, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Font } from 'fontkit';
import { PdfGenerationError } from '../../types/domain';
import type { PaperGeometry, PdfGenerationErrorCode, ValidatedSong } from '../../types/domain';
import { PdfSnapshot } from '../../types/domain';
import { validatePaperGeometry } from '../paper/paper-dimensions';
import { createPdfFilename } from './pdf-filename';
import { getPdfFontMetrics, PDF_FONT_FAMILY, registerPdfFonts } from './font-registry';
import { millimetersToPoints, PDF_HEADER_BODY_GAP_PT, PDF_HEADER_RESERVED_HEIGHT_PT, PDF_LAYOUT, PDF_MAX_PAGE_DIMENSION_PT } from './layout-config';

function generationError(code: PdfGenerationErrorCode, message: string): PdfGenerationError {
  return new PdfGenerationError(code, message);
}

function hasSupportedGlyphs(text: string, font: Font): boolean {
  for (const character of text) {
    if (/^[\s\p{Cf}]$/u.test(character)) continue;
    if (!font.hasGlyphForCodePoint(character.codePointAt(0)!)) return false;
  }
  return true;
}

function measureText(text: string, font: Font, fontSizePt: number): number {
  return (font.layout(text).advanceWidth / font.unitsPerEm) * fontSizePt;
}

function validateContentWidth(text: string, font: Font, columnWidthPt: number): void {
  for (const token of text.split(/\s+/u).filter(Boolean)) {
    if (measureText(token, font, PDF_LAYOUT.lyricsFontSizePt) > columnWidthPt) {
      throw generationError('unsafe-layout', 'A lyric token cannot fit within the selected paper columns.');
    }
  }
}

function validateSongForRendering(song: ValidatedSong): PaperGeometry {
  if (!song || !song.song || !song.lyrics || !song.paper || !song.lyrics.text.trim()) {
    throw generationError('invalid-input', 'The validated song data is incomplete.');
  }
  if (song.paper.unit !== 'mm' || song.paper.width >= song.paper.height) {
    throw generationError('invalid-geometry', 'The selected page dimensions must be valid portrait millimeters.');
  }
  const geometry = validatePaperGeometry(song.paper);
  const widthPt = millimetersToPoints(song.paper.width);
  const heightPt = millimetersToPoints(song.paper.height);
  if (!geometry.valid || !Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt > PDF_MAX_PAGE_DIMENSION_PT || heightPt > PDF_MAX_PAGE_DIMENSION_PT) {
    throw generationError('invalid-geometry', 'The selected page dimensions exceed the safe PDF layout limits.');
  }
  if (geometry.usableBodyHeightPt < PDF_LAYOUT.lyricsFontSizePt * PDF_LAYOUT.lineHeight) {
    throw generationError('invalid-geometry', 'The selected paper does not leave enough height for a lyric line.');
  }
  return geometry;
}

function createDocumentDefinition(song: ValidatedSong, geometry: PaperGeometry): TDocumentDefinitions {
  const marginPt = millimetersToPoints(PDF_LAYOUT.marginMm);
  const columnGapPt = millimetersToPoints(PDF_LAYOUT.columnGapMm);
  const pageWidthPt = millimetersToPoints(song.paper.width);
  const pageHeightPt = millimetersToPoints(song.paper.height);
  const contentWidthPt = pageWidthPt - marginPt * 2;
  const bodyTopMarginPt = marginPt + PDF_HEADER_RESERVED_HEIGHT_PT + PDF_HEADER_BODY_GAP_PT;
  const columns: ContentColumns = {
    columns: [
      {
        width: geometry.columnWidthPt,
        text: song.lyrics.text,
        fontSize: PDF_LAYOUT.lyricsFontSizePt,
        lineHeight: PDF_LAYOUT.lineHeight,
        margin: [0, 0, 0, PDF_LAYOUT.paragraphSpacingPt],
      },
      { width: geometry.columnWidthPt, text: '' },
    ],
    columnGap: columnGapPt,
    snakingColumns: true,
  };

  return {
    pageSize: { width: pageWidthPt, height: pageHeightPt },
    pageOrientation: 'portrait',
    pageMargins: [marginPt, bodyTopMarginPt, marginPt, marginPt],
    defaultStyle: {
      font: PDF_FONT_FAMILY,
      fontSize: PDF_LAYOUT.lyricsFontSizePt,
      color: PDF_LAYOUT.textColor,
      lineHeight: PDF_LAYOUT.lineHeight,
    },
    background: () => [
      {
        text: song.song.title,
        fontSize: PDF_LAYOUT.titleFontSizePt,
        bold: true,
        lineHeight: 1,
        width: contentWidthPt,
        margin: 0,
        color: PDF_LAYOUT.textColor,
        absolutePosition: { x: marginPt, y: marginPt },
      },
      {
        text: song.song.artist,
        fontSize: PDF_LAYOUT.artistFontSizePt,
        lineHeight: 1,
        width: contentWidthPt,
        margin: 0,
        color: PDF_LAYOUT.textColor,
        absolutePosition: { x: marginPt, y: marginPt + PDF_LAYOUT.titleFontSizePt },
      },
    ],
    content: [columns],
  };
}

export async function generatePdf(song: ValidatedSong): Promise<PdfSnapshot> {
  const geometry = validateSongForRendering(song);
  let fonts: ReturnType<typeof getPdfFontMetrics>;
  try {
    registerPdfFonts();
    fonts = getPdfFontMetrics();
  } catch {
    throw generationError('font-loading', 'The embedded PDF fonts could not be loaded.');
  }

  const content = [
    { text: song.song.title, font: fonts.bold },
    { text: song.song.artist, font: fonts.regular },
    { text: song.lyrics.text, font: fonts.regular },
  ];
  if (content.some(({ text, font }) => !hasSupportedGlyphs(text, font))) {
    throw generationError('unsupported-glyph', 'The embedded PDF font cannot safely render one or more characters in this song.');
  }

  const pageWidthPt = millimetersToPoints(song.paper.width);
  const columnWidthPt = geometry.columnWidthPt;
  const headerWidthPt = pageWidthPt - millimetersToPoints(PDF_LAYOUT.marginMm) * 2;
  if (/\r|\n/.test(song.song.title) || /\r|\n/.test(song.song.artist) ||
    measureText(song.song.title, fonts.bold, PDF_LAYOUT.titleFontSizePt) > headerWidthPt ||
    measureText(song.song.artist, fonts.regular, PDF_LAYOUT.artistFontSizePt) > headerWidthPt) {
    throw generationError('unsafe-layout', 'The song metadata cannot fit safely in the current single-line page header.');
  }
  validateContentWidth(song.lyrics.text, fonts.regular, columnWidthPt);

  let blob: Blob;
  try {
    blob = await pdfMake.createPdf(createDocumentDefinition(song, geometry)).getBlob();
  } catch {
    throw generationError('generation-failed', 'The PDF could not be generated for the validated song.');
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
    throw generationError('generation-failed', 'The PDF generator returned an invalid document.');
  }

  let pageCount: number;
  try {
    const { getPdfPageCount } = await import('../preview/inspect-pdf');
    pageCount = await getPdfPageCount(bytes);
    if (pageCount < 1) throw new Error('No pages were generated.');
  } catch {
    throw generationError('inspection-failed', 'The generated PDF could not be inspected.');
  }

  return new PdfSnapshot(bytes, pageCount, createPdfFilename(song.song), song.paper, geometry);
}
