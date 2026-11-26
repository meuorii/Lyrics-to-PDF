import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import type { ContentColumns, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { PdfGenerationInput, PdfGenerationResult } from '../../types/domain';
import { millimetersToPoints, PDF_HEADER_BODY_GAP_PT, PDF_HEADER_RESERVED_HEIGHT_PT } from './layout-config';

pdfMake.addVirtualFileSystem(pdfFonts);

function createDocumentDefinition(input: PdfGenerationInput): TDocumentDefinitions {
  const { layout, lyrics, song } = input;
  if (layout.paperSize !== 'A4') {
    throw new Error('The Phase 1 feasibility prototype currently supports A4 only.');
  }
  const marginPt = millimetersToPoints(layout.marginMm);
  const bodyTopMarginPt = marginPt + PDF_HEADER_RESERVED_HEIGHT_PT + PDF_HEADER_BODY_GAP_PT;
  const columns: ContentColumns = {
    columns: [
      {
        width: '*',
        text: lyrics.rawText,
        fontSize: layout.lyricsFontSizePt,
        lineHeight: layout.lineHeight,
        margin: [0, 0, 0, layout.paragraphSpacingPt],
      },
      { width: '*', text: '' },
    ],
    columnGap: millimetersToPoints(layout.columnGapMm),
    snakingColumns: true,
  };

  return {
    pageSize: 'A4',
    pageOrientation: layout.orientation,
    pageMargins: [marginPt, bodyTopMarginPt, marginPt, marginPt],
    defaultStyle: {
      font: layout.fontFamily,
      fontSize: layout.lyricsFontSizePt,
      color: layout.textColor,
      lineHeight: layout.lineHeight,
    },
    background: () => [
      {
        text: song.title,
        fontSize: layout.titleFontSizePt,
        bold: true,
        lineHeight: 1,
        margin: 0,
        absolutePosition: { x: marginPt, y: marginPt },
      },
      {
        text: song.artist,
        fontSize: layout.artistFontSizePt,
        lineHeight: 1,
        margin: 0,
        absolutePosition: { x: marginPt, y: marginPt + layout.titleFontSizePt },
      },
    ],
    content: [columns],
    styles: { lyrics: { lineHeight: 1, margin: 0 } },
  };
}

export async function generatePdf(input: PdfGenerationInput): Promise<PdfGenerationResult> {
  const blob = await pdfMake.createPdf(createDocumentDefinition(input)).getBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { blob, bytes };
}
