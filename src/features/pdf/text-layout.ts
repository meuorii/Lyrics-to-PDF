import { LineBreaker } from 'linebreak';
import { segmentGraphemes, type ResolvedFontRun } from './font-fallback';

export type MeasuredTextLine = {
  runs: ResolvedFontRun[];
  widthPt: number;
  heightPt: number;
};

type GraphemeRun = ResolvedFontRun;

function mergeGraphemes(graphemes: GraphemeRun[]): ResolvedFontRun[] {
  const result: ResolvedFontRun[] = [];
  for (const grapheme of graphemes) {
    const previous = result.at(-1);
    if (previous?.font === grapheme.font) previous.text += grapheme.text;
    else result.push({ ...grapheme });
  }
  return result;
}

function lineMetrics(runs: ResolvedFontRun[], fontSizePt: number, lineHeight: number): MeasuredTextLine {
  let widthPt = 0;
  let heightPt = fontSizePt * lineHeight;
  for (const run of runs) {
    const layout = run.face.layout(run.text);
    widthPt += (layout.advanceWidth / run.face.unitsPerEm) * fontSizePt;
    const glyphHeight = ((layout.bbox.maxY - layout.bbox.minY) / run.face.unitsPerEm) * fontSizePt;
    heightPt = Math.max(heightPt, glyphHeight);
  }
  return { runs, widthPt, heightPt };
}

function wrapParagraph(atoms: GraphemeRun[], maxWidthPt: number, fontSizePt: number, lineHeight: number): MeasuredTextLine[] {
  if (!atoms.length) return [{ runs: [], widthPt: 0, heightPt: fontSizePt * lineHeight }];
  const text = atoms.map(({ text: grapheme }) => grapheme).join('');
  const graphemeEnds = new Set<number>();
  let offset = 0;
  for (const atom of atoms) {
    offset += atom.text.length;
    graphemeEnds.add(offset);
  }
  const breaks = new Set<number>();
  const breaker = new LineBreaker(text);
  let opportunity: ReturnType<LineBreaker['nextBreak']>;
  while ((opportunity = breaker.nextBreak())) if (graphemeEnds.has(opportunity.position)) breaks.add(opportunity.position);
  const atomOffsets = [0];
  for (const atom of atoms) atomOffsets.push(atomOffsets.at(-1)! + atom.text.length);

  const result: MeasuredTextLine[] = [];
  let start = 0;
  while (start < atoms.length) {
    let cursor = start;
    let lastBreak = -1;
    while (cursor < atoms.length) {
      const candidate = lineMetrics(mergeGraphemes(atoms.slice(start, cursor + 1)), fontSizePt, lineHeight);
      if (candidate.widthPt > maxWidthPt + 0.001) break;
      cursor += 1;
      if (breaks.has(atomOffsets[cursor]!)) lastBreak = cursor;
    }
    if (cursor === start) throw new RangeError('An indivisible grapheme cannot fit in the available text width.');
    const end = cursor === atoms.length ? cursor : lastBreak > start ? lastBreak : cursor;
    result.push(lineMetrics(mergeGraphemes(atoms.slice(start, end)), fontSizePt, lineHeight));
    start = end;
  }
  return result;
}

export function wrapResolvedText(runs: ResolvedFontRun[], maxWidthPt: number, fontSizePt: number, lineHeight = 1): MeasuredTextLine[] {
  if (!(maxWidthPt > 0) || !(fontSizePt > 0) || !(lineHeight > 0)) throw new RangeError('Text layout dimensions must be positive.');
  const paragraphs: GraphemeRun[][] = [[]];
  for (const run of runs) {
    const parts = segmentGraphemes(run.text);
    for (const part of parts) {
      if (part === '\n') paragraphs.push([]);
      else paragraphs.at(-1)!.push({ ...run, text: part });
    }
  }
  return paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, maxWidthPt, fontSizePt, lineHeight));
}
