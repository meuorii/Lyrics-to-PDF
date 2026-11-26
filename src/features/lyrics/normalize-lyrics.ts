import type { LyricsSection, NormalizationWarning, NormalizedLyrics } from '../../types/domain';
import { mergeMultilineSectionLabel, parseSectionLabel } from './section-labels';

function isGeniusArtifact(line: string): boolean {
  const trimmed = line.trim();
  if (!/^https?:\/\//i.test(trimmed) || /\s/.test(trimmed)) return false;
  try {
    const { hostname } = new URL(trimmed);
    return hostname === 'genius.com' || hostname.endsWith('.genius.com');
  } catch {
    return false;
  }
}

export function normalizeLyrics(rawText: string): NormalizedLyrics {
  const warnings: NormalizationWarning[] = [];
  const source = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const normalizedLines = source.split('\n').map((line) => line.trim() === '' ? '' : line.replace(/[\t ]+$/g, ''));
  const lines = normalizedLines.filter((line) => {
    if (!isGeniusArtifact(line)) return true;
    warnings.push({ code: 'genius-artifact-removed', line: line.trim() });
    return false;
  });
  while (lines[0] === '') lines.shift();
  while (lines.at(-1) === '') lines.pop();

  const collapsed = lines.reduce<string[]>((result, line) => {
    if (line === '' && result.at(-1) === '') return result;
    result.push(line);
    return result;
  }, []);
  const sections: LyricsSection[] = [];
  for (let index = 0; index < collapsed.length; index += 1) {
    const line = collapsed[index]!;
    const multiline = mergeMultilineSectionLabel(collapsed, index);
    const parsed = parseSectionLabel(line) ?? multiline?.label ?? null;
    if (parsed) {
      while (sections.length && sections.at(-1)!.lines.at(-1) === '') sections.at(-1)!.lines.pop();
      sections.push({ label: parsed.label, lines: [] });
      if (multiline && !parseSectionLabel(line)) index += multiline.consumed - 1;
    }
    else {
      if (!sections.length) sections.push({ label: null, lines: [] });
      const current = sections.at(-1)!;
      if (current.label !== null && current.lines.length === 0 && line === '') continue;
      current.lines.push(line);
    }
  }
  while (sections.length && sections.at(-1)!.lines.at(-1) === '') sections.at(-1)!.lines.pop();
  const text = sections.map(({ label, lines: sectionLines }) => [label, ...sectionLines].filter((line) => line !== null).join('\n')).join('\n\n');
  return { rawText, text, sections, warnings };
}
