import type { FontFaceMetrics, PdfFontRegistry } from './font-registry';

export type PdfFontScript = 'latin' | 'kr' | 'jp' | 'sc' | 'tc';
export type ScriptTextRun = { text: string; script: PdfFontScript };
export type ResolvedFontRun = { text: string; font: string; face: FontFaceMetrics; bold: boolean };

type FontLoader = (scripts: readonly PdfFontScript[]) => Promise<PdfFontRegistry>;

export class UnsupportedPdfGlyphError extends Error {}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const hangul = /\p{Script=Hangul}/u;
const kana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const han = /\p{Script=Han}/u;
const simplifiedClues = new Set(Array.from('这还个发时体简后里为会说来开关门与乐车广万传药梦头云气网书见听应实对将无业'));
const traditionalClues = new Set(Array.from('這還個發時體簡後裡為會說來開關門與樂車廣萬傳藥夢頭雲氣網書見聽應實對將無業'));

export function segmentGraphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
}

function regionHint(graphemes: string[]): PdfFontScript {
  if (graphemes.some((part) => Array.from(part).some((character) => traditionalClues.has(character)))) return 'tc';
  if (graphemes.some((part) => Array.from(part).some((character) => simplifiedClues.has(character)))) return 'sc';
  return 'jp';
}

function scriptForGrapheme(grapheme: string, hanContext: PdfFontScript): PdfFontScript {
  if (hangul.test(grapheme)) return 'kr';
  if (kana.test(grapheme)) return 'jp';
  if (!han.test(grapheme)) return 'latin';
  if (Array.from(grapheme).some((character) => traditionalClues.has(character))) return 'tc';
  if (Array.from(grapheme).some((character) => simplifiedClues.has(character))) return 'sc';
  return hanContext;
}

export function getFontRunsForText(text: string): ScriptTextRun[] {
  const graphemes = segmentGraphemes(text);
  const hints = new Map<number, PdfFontScript>();
  for (let start = 0; start < graphemes.length;) {
    if (!hangul.test(graphemes[start]!) && !kana.test(graphemes[start]!) && !han.test(graphemes[start]!)) {
      start += 1;
      continue;
    }
    let end = start + 1;
    while (end < graphemes.length && (hangul.test(graphemes[end]!) || kana.test(graphemes[end]!) || han.test(graphemes[end]!))) end += 1;
    const cjkRun = graphemes.slice(start, end);
    const hint = cjkRun.some((part) => kana.test(part)) ? 'jp' : cjkRun.some((part) => hangul.test(part)) ? 'kr' : regionHint(cjkRun);
    for (let index = start; index < end; index += 1) hints.set(index, hint);
    start = end;
  }
  const scripts = graphemes.map((grapheme, index) => scriptForGrapheme(grapheme, hints.get(index) ?? 'latin'));
  for (let index = 0; index < graphemes.length; index += 1) {
    if (/^\s+$/u.test(graphemes[index]!)) {
      const previous = scripts[index - 1];
      const next = scripts[index + 1];
      if (next) scripts[index] = next;
      else if (previous) scripts[index] = previous;
    }
  }
  const runs: ScriptTextRun[] = [];
  for (const [index, grapheme] of graphemes.entries()) {
    const script = scripts[index]!;
    const previous = runs.at(-1);
    if (previous?.script === script) previous.text += grapheme;
    else runs.push({ text: grapheme, script });
  }
  return runs;
}

function faceSupportsGrapheme(grapheme: string, face: FontFaceMetrics): boolean {
  for (const character of grapheme) {
    const codePoint = character.codePointAt(0)!;
    if (/^\s$/u.test(character) || /^\p{Cf}$/u.test(character) || (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)) continue;
    if (!face.hasGlyphForCodePoint(codePoint)) return false;
  }
  return true;
}

export async function resolveFontRuns(text: string, weight: 'regular' | 'bold', loadFonts: FontLoader): Promise<ResolvedFontRun[]> {
  const scriptRuns = getFontRunsForText(text);
  let fonts = await loadFonts(scriptRuns.map(({ script }) => script));
  const result: ResolvedFontRun[] = [];
  for (const { text: runText, script } of scriptRuns) {
    for (const grapheme of segmentGraphemes(runText)) {
      const candidates: PdfFontScript[] = script === 'latin' ? ['latin'] : [script, 'jp', 'kr', 'sc', 'tc', 'latin'];
      let chosen: { family: string; face: FontFaceMetrics } | undefined;
      for (const candidate of [...new Set(candidates)]) {
        if (candidate !== 'latin' && !fonts[candidate]) fonts = { ...fonts, ...await loadFonts([candidate]) };
        const faces = fonts[candidate];
        const face = faces?.[weight];
        if (faces && face && faceSupportsGrapheme(grapheme, face)) {
          chosen = { family: faces.family, face };
          break;
        }
      }
      if (!chosen) throw new UnsupportedPdfGlyphError('No registered PDF font covers a required grapheme.');
      const previous = result.at(-1);
      const bold = weight === 'bold';
      if (previous?.font === chosen.family && previous.bold === bold) previous.text += grapheme;
      else result.push({ text: grapheme, font: chosen.family, face: chosen.face, bold });
    }
  }
  return result;
}
