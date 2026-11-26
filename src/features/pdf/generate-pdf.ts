import pdfMake from 'pdfmake/build/pdfmake.js';
import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import { PdfGenerationError } from '../../types/domain';
import type { PaperGeometry, PdfGenerationErrorCode, ValidatedSong } from '../../types/domain';
import { PdfSnapshot } from '../../types/domain';
import { validatePaperGeometry } from '../paper/paper-dimensions';
import { createPdfFilename } from './pdf-filename';
import { resolveFontRuns, UnsupportedPdfGlyphError, type ResolvedFontRun } from './font-fallback';
import { loadPdfFonts, PDF_FONT_FAMILY } from './font-registry';
import { millimetersToPoints, PDF_HEADER_BODY_GAP_PT, PDF_LAYOUT, PDF_MAX_PAGE_DIMENSION_PT } from './layout-config';
import { paginateLayout, type PaginatedPage, type PaginationItem } from './pagination';
import { wrapResolvedText, type MeasuredTextLine } from './text-layout';

function generationError(code: PdfGenerationErrorCode, message: string): PdfGenerationError {
  return new PdfGenerationError(code, message);
}

function validateSong(song: ValidatedSong): void {
  if (!song || !song.song || !song.lyrics || !song.paper || !song.lyrics.text.trim()) {
    throw generationError('invalid-input', 'The validated song data is incomplete.');
  }
  if (song.paper.unit !== 'mm' || song.paper.width >= song.paper.height) {
    throw generationError('invalid-geometry', 'The selected page dimensions must be valid portrait millimeters.');
  }
}

async function resolvedRuns(text: string, weight: 'regular' | 'bold'): Promise<ResolvedFontRun[]> {
  try {
    return await resolveFontRuns(text, weight, loadPdfFonts);
  } catch (error) {
    if (error instanceof UnsupportedPdfGlyphError) {
      throw generationError('unsupported-glyph', 'The embedded PDF fonts cannot safely render one or more characters in this song.');
    }
    throw generationError('font-loading', 'A required embedded PDF font could not be loaded.');
  }
}

async function wrapText(text: string, weight: 'regular' | 'bold', widthPt: number, sizePt: number): Promise<MeasuredTextLine[]> {
  const runs = await resolvedRuns(text, weight);
  try {
    return wrapResolvedText(runs, widthPt, sizePt, PDF_LAYOUT.lineHeight);
  } catch {
    throw generationError('unsafe-layout', 'A lyric or metadata grapheme cannot fit within the available PDF layout.');
  }
}

function lineContent(line: MeasuredTextLine): ContentText['text'] {
  return line.runs.map(({ text, font, bold }) => ({ text, font, bold }));
}

function textLine(line: MeasuredTextLine, sizePt: number): ContentText {
  return {
    text: line.runs.length ? lineContent(line) : ' ',
    fontSize: sizePt,
    lineHeight: PDF_LAYOUT.lineHeight,
    color: PDF_LAYOUT.textColor,
    noWrap: true,
    preserveLeadingSpaces: true,
    margin: [0, 0, 0, Math.max(0, line.heightPt - sizePt * PDF_LAYOUT.lineHeight)],
  };
}

async function headerLayout(song: ValidatedSong, widthPt: number) {
  const title = await wrapText(song.song.title, 'bold', widthPt, PDF_LAYOUT.titleFontSizePt);
  const artist = await wrapText(song.song.artist, 'regular', widthPt, PDF_LAYOUT.artistFontSizePt);
  const titleHeightPt = title.reduce((sum, line) => sum + line.heightPt, 0);
  const artistHeightPt = artist.reduce((sum, line) => sum + line.heightPt, 0);
  return { title, artist, titleHeightPt, artistHeightPt, heightPt: titleHeightPt + artistHeightPt };
}

function repeatedHeader(header: Awaited<ReturnType<typeof headerLayout>>, x: number, y: number): Content[] {
  const result: Content[] = [];
  let top = y;
  for (const line of header.title) {
    result.push({ ...textLine(line, PDF_LAYOUT.titleFontSizePt), absolutePosition: { x, y: top } });
    top += line.heightPt;
  }
  for (const line of header.artist) {
    result.push({ ...textLine(line, PDF_LAYOUT.artistFontSizePt), absolutePosition: { x, y: top } });
    top += line.heightPt;
  }
  return result;
}

async function bodyItems(song: ValidatedSong, columnWidthPt: number): Promise<PaginationItem[]> {
  const items: PaginationItem[] = [];
  const separationPt = PDF_LAYOUT.lyricsFontSizePt * PDF_LAYOUT.lineHeight;
  let hasPriorSection = false;
  for (const section of song.lyrics.sections) {
    const label = section.label ? await wrapText(section.label, 'regular', columnWidthPt, PDF_LAYOUT.sectionLabelFontSizePt) : [];
    const firstBodyIndex = section.label ? section.lines.findIndex((line) => line.length > 0) : -1;
    const firstTextLines = firstBodyIndex >= 0
      ? await wrapText(section.lines[firstBodyIndex]!, 'regular', columnWidthPt, PDF_LAYOUT.lyricsFontSizePt)
      : [];
    if (section.label) {
      items.push({
        kind: 'section',
        label,
        ...(firstTextLines[0] ? { firstLine: firstTextLines[0] } : {}),
        separationPt: hasPriorSection ? separationPt : 0,
      });
    } else if (hasPriorSection) {
      items.push({ kind: 'blank', heightPt: separationPt });
    }
    for (let lineIndex = 0; lineIndex < section.lines.length; lineIndex += 1) {
      if (lineIndex === firstBodyIndex) {
        for (const line of firstTextLines.slice(1)) items.push({ kind: 'line', line });
        continue;
      }
      const lineText = section.lines[lineIndex]!;
      if (lineText === '') {
        items.push({ kind: 'blank', heightPt: separationPt });
      } else {
        for (const line of await wrapText(lineText, 'regular', columnWidthPt, PDF_LAYOUT.lyricsFontSizePt)) {
          items.push({ kind: 'line', line });
        }
      }
    }
    hasPriorSection = true;
  }
  return items;
}

function renderPages(pages: PaginatedPage[], geometry: PaperGeometry, bodyTopPt: number, marginPt: number, gutterPt: number): Content[] {
  const content: Content[] = [];
  pages.forEach((page, pageIndex) => {
    let hasContent = false;
    for (const columnIndex of [0, 1] as const) {
      let top = bodyTopPt;
      const x = columnIndex === 0 ? marginPt : marginPt + geometry.columnWidthPt + gutterPt;
      for (const item of page.columns[columnIndex].items) {
        if (item.kind === 'blank') {
          top += item.heightPt;
          continue;
        }
        const lines = item.kind === 'line'
          ? [{ line: item.line, sizePt: PDF_LAYOUT.lyricsFontSizePt }]
          : [
              ...item.label.map((line) => ({ line, sizePt: PDF_LAYOUT.sectionLabelFontSizePt })),
              ...(item.firstLine ? [{ line: item.firstLine, sizePt: PDF_LAYOUT.lyricsFontSizePt }] : []),
            ];
        for (const { line, sizePt } of lines) {
          content.push({
            ...textLine(line, sizePt),
            absolutePosition: { x, y: top },
            ...(pageIndex > 0 && !hasContent ? { pageBreak: 'before' as const } : {}),
          });
          hasContent = true;
          top += line.heightPt;
        }
      }
    }
  });
  return content;
}

function createDocumentDefinition(
  song: ValidatedSong,
  pages: PaginatedPage[],
  geometry: PaperGeometry,
  header: Awaited<ReturnType<typeof headerLayout>>,
): TDocumentDefinitions {
  const marginPt = millimetersToPoints(PDF_LAYOUT.marginMm);
  const columnGapPt = millimetersToPoints(PDF_LAYOUT.columnGapMm);
  const pageWidthPt = millimetersToPoints(song.paper.width);
  const pageHeightPt = millimetersToPoints(song.paper.height);
  const pageBodyTopPt = marginPt + header.heightPt + PDF_HEADER_BODY_GAP_PT;
  return {
    pageSize: { width: pageWidthPt, height: pageHeightPt },
    pageOrientation: 'portrait',
    pageMargins: [marginPt, pageBodyTopPt, marginPt, marginPt],
    defaultStyle: {
      font: PDF_FONT_FAMILY,
      fontSize: PDF_LAYOUT.lyricsFontSizePt,
      color: PDF_LAYOUT.textColor,
      lineHeight: PDF_LAYOUT.lineHeight,
    },
    background: () => repeatedHeader(header, marginPt, marginPt),
    content: renderPages(pages, geometry, pageBodyTopPt, marginPt, columnGapPt),
  };
}

export async function generatePdf(song: ValidatedSong): Promise<PdfSnapshot> {
  validateSong(song);
  const pageWidthPt = millimetersToPoints(song.paper.width);
  const pageHeightPt = millimetersToPoints(song.paper.height);
  if (!Number.isFinite(pageWidthPt) || !Number.isFinite(pageHeightPt) || pageWidthPt > PDF_MAX_PAGE_DIMENSION_PT || pageHeightPt > PDF_MAX_PAGE_DIMENSION_PT) {
    throw generationError('invalid-geometry', 'The selected page dimensions exceed the safe PDF layout limits.');
  }
  const marginPt = millimetersToPoints(PDF_LAYOUT.marginMm);
  const columnGapPt = millimetersToPoints(PDF_LAYOUT.columnGapMm);
  const columnWidthPt = (pageWidthPt - marginPt * 2 - columnGapPt) / 2;
  if (!(columnWidthPt > 0)) throw generationError('invalid-geometry', 'The selected paper is too narrow for the approved margins and columns.');

  let header: Awaited<ReturnType<typeof headerLayout>>;
  try {
    header = await headerLayout(song, pageWidthPt - marginPt * 2);
  } catch (error) {
    if (error instanceof PdfGenerationError) throw error;
    throw generationError('font-loading', 'The embedded PDF fonts could not be prepared.');
  }
  const bodyTopPt = marginPt + header.heightPt + PDF_HEADER_BODY_GAP_PT;
  const columnHeightPt = pageHeightPt - bodyTopPt - marginPt;
  if (!(columnHeightPt >= PDF_LAYOUT.lyricsFontSizePt * PDF_LAYOUT.lineHeight)) {
    throw generationError('invalid-geometry', 'The repeated metadata header leaves too little page height for lyrics.');
  }
  const geometry: PaperGeometry = {
    ...validatePaperGeometry(song.paper),
    valid: true,
    issues: [],
    columnWidthPt,
    usableBodyHeightPt: columnHeightPt,
  };

  let pages: PaginatedPage[];
  try {
    pages = paginateLayout(await bodyItems(song, columnWidthPt), columnHeightPt);
  } catch (error) {
    if (error instanceof PdfGenerationError) throw error;
    throw generationError('pagination-failed', 'The lyrics could not be placed safely in the available page columns.');
  }

  let blob: Blob;
  try {
    blob = await pdfMake.createPdf(createDocumentDefinition(song, pages, geometry, header)).getBlob();
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
    if (pageCount !== pages.length) {
      throw generationError('inspection-failed', 'PDF pagination expected ' + pages.length + ' pages, but the rendered document has ' + pageCount + '.');
    }
  } catch (error) {
    if (error instanceof PdfGenerationError) throw error;
    throw generationError('inspection-failed', 'The generated PDF could not be inspected.');
  }
  return new PdfSnapshot(bytes, pageCount, createPdfFilename(song.song), song.paper, geometry);
}
