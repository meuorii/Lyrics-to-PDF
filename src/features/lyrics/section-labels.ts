export const SECTION_REGISTRY = {
  numbering: 'optional-decimal-preserved',
  sections: [
    { name: 'Intro', aliases: [] },
    { name: 'Verse', aliases: [] },
    { name: 'Pre-Verse', aliases: ['Pre Verse'] },
    { name: 'Pre-Chorus', aliases: ['Pre Chorus'] },
    { name: 'Chorus', aliases: [] },
    { name: 'Post-Chorus', aliases: ['Post Chorus'] },
    { name: 'Bridge', aliases: [] },
    { name: 'Refrain', aliases: [] },
    { name: 'Hook', aliases: [] },
    { name: 'Interlude', aliases: [] },
    { name: 'Outro', aliases: [] },
    { name: 'Coda', aliases: [] },
    { name: 'Rap', aliases: [] },
    { name: 'Rap Verse', aliases: [] },
    { name: 'Spoken Word', aliases: ['Spoken-Word'] },
    { name: 'Spoken Intro', aliases: [] },
    { name: 'Spoken Outro', aliases: [] },
    { name: 'Dialogue', aliases: [] },
    { name: 'Skit', aliases: [] },
    { name: 'Narration', aliases: [] },
    { name: 'Freestyle', aliases: [] },
    { name: 'Instrumental', aliases: [] },
    { name: 'Instrumental Break', aliases: [] },
    { name: 'Instrumental Intro', aliases: [] },
    { name: 'Instrumental Outro', aliases: [] },
    { name: 'Solo', aliases: [] },
    { name: 'Guitar Solo', aliases: [] },
    { name: 'Piano Solo', aliases: [] },
    { name: 'Drum Solo', aliases: [] },
    { name: 'Bass Solo', aliases: [] },
    { name: 'Break', aliases: [] },
    { name: 'Breakdown', aliases: [] },
    { name: 'Dance Break', aliases: [] },
    { name: 'Build-Up', aliases: ['Build Up'] },
    { name: 'Drop', aliases: [] },
    { name: 'Pre-Drop', aliases: ['Pre Drop'] },
    { name: 'Post-Drop', aliases: ['Post Drop'] },
    { name: 'Transition', aliases: [] },
    { name: 'Reprise', aliases: [] },
    { name: 'Medley', aliases: [] },
    { name: 'Ad-Libs', aliases: ['Adlibs', 'Ad Libs'] },
    { name: 'Vocal Break', aliases: [] },
    { name: 'Vocal Solo', aliases: [] },
    { name: 'Chant', aliases: [] },
    { name: 'Choir', aliases: [] },
    { name: 'Sample', aliases: [] },
    { name: 'Call and Response', aliases: ['Call & Response'] },
    { name: 'Vocalizing', aliases: [] },
  ],
} as const;

export type CanonicalSectionName = (typeof SECTION_REGISTRY.sections)[number]['name'];
type SectionDefinition = (typeof SECTION_REGISTRY.sections)[number];
type AnnotationKind = 'referenced-song' | 'medley-song-list' | 'performers';

export type ParsedSectionLabel = {
  label: string;
  canonicalName: CanonicalSectionName;
  sectionNumber: string | null;
  annotations: readonly AnnotationKind[];
  hasPerformerSuffix: boolean;
};

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

const SECTION_MATCHES = Object.freeze(SECTION_REGISTRY.sections
  .flatMap((section) => [section.name, ...section.aliases].map((token) => ({ section, token: normalizeToken(token) })))
  .sort((left, right) => right.token.length - left.token.length));

function matchSectionName(value: string): { section: SectionDefinition; tokenLength: number } | null {
  const folded = value.toLowerCase();
  for (const candidate of SECTION_MATCHES) {
    if (!folded.startsWith(candidate.token)) continue;
    const next = folded[candidate.token.length];
    if (next === undefined || next === ':' || next === '(' || /\s/u.test(next)) {
      return { section: candidate.section, tokenLength: candidate.token.length };
    }
  }
  return null;
}

function closingParenthesis(value: string): number {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') {
      depth -= 1;
      if (depth < 0) return -1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function hasNonEmptyColonAnnotation(value: string): boolean {
  return value.startsWith(':') && value.slice(1).trim().length > 0;
}

function parseRecognizedContent(content: string): ParsedSectionLabel | null {
  const normalized = content.trim().replace(/\s+/gu, ' ');
  const matched = matchSectionName(normalized);
  if (!matched) return null;

  let remainder = normalized.slice(matched.tokenLength).trim();
  const numberMatch = /^(\d+)(?=$|\s|:|\()/u.exec(remainder);
  const sectionNumber = numberMatch?.[1] ?? null;
  if (numberMatch) remainder = remainder.slice(numberMatch[0].length).trim();

  const annotations: AnnotationKind[] = [];
  if (remainder.startsWith('(')) {
    const close = closingParenthesis(remainder);
    if (close < 0 || !remainder.slice(1, close).trim()) return null;
    annotations.push('referenced-song');
    remainder = remainder.slice(close + 1).trim();
    if (remainder && !hasNonEmptyColonAnnotation(remainder)) return null;
    if (remainder) annotations.push('performers');
  } else if (remainder) {
    if (!hasNonEmptyColonAnnotation(remainder)) return null;
    annotations.push(matched.section.name === 'Medley' ? 'medley-song-list' : 'performers');
  }

  const label = `[${matched.section.name}${sectionNumber ? ` ${sectionNumber}` : ''}]`;
  return {
    label,
    canonicalName: matched.section.name,
    sectionNumber,
    annotations,
    hasPerformerSuffix: annotations.includes('performers'),
  };
}

export function parseSectionLabel(line: string): ParsedSectionLabel | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const content = trimmed.slice(1, -1);
  if (content.includes('[') || content.includes(']') || content.includes('\r') || content.includes('\n')) return null;
  return parseRecognizedContent(content);
}

function hasOpenParenthetical(value: string): boolean {
  let depth = 0;
  for (const character of value) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth > 0;
}

function hasIncompletePerformerList(value: string): boolean {
  let performerList = value.startsWith(':') ? value.slice(1).trim() : '';
  if (!performerList && value.startsWith('(')) {
    const close = closingParenthesis(value);
    const suffix = close >= 0 ? value.slice(close + 1).trim() : '';
    if (suffix.startsWith(':')) performerList = suffix.slice(1).trim();
  }
  return /(?:,|&|\band)$/iu.test(performerList);
}

/** Joins only one continuation line when an annotation is visibly incomplete. */
export function mergeMultilineSectionLabel(lines: string[], start: number): { label: ParsedSectionLabel; consumed: number } | null {
  const opening = lines[start]?.trim();
  if (!opening?.startsWith('[') || opening.includes(']')) return null;
  const partial = opening.slice(1).trim().replace(/\s+/gu, ' ');
  const matched = matchSectionName(partial);
  if (!matched) return null;
  let remainder = partial.slice(matched.tokenLength).trim();
  const numberMatch = /^(\d+)(?=$|\s|:|\()/u.exec(remainder);
  if (numberMatch) remainder = remainder.slice(numberMatch[0].length).trim();
  const continuation = lines[start + 1]?.trim();
  if (!continuation || continuation.startsWith('[') || !continuation.endsWith(']')) return null;
  const referenceClose = remainder.startsWith('(') ? closingParenthesis(remainder) : -1;
  const referenceSuffix = referenceClose >= 0 ? remainder.slice(referenceClose + 1).trim() : '';
  const completeReferenceWaitingForPerformers = referenceClose >= 0 && (referenceSuffix === ':' || (referenceSuffix === '' && continuation.startsWith(':')));
  const clearlyIncomplete = remainder === ':' || hasOpenParenthetical(remainder) || hasIncompletePerformerList(remainder) || completeReferenceWaitingForPerformers;
  if (!clearlyIncomplete) return null;
  const parsed = parseSectionLabel(`${opening} ${continuation}`);
  return parsed ? { label: parsed, consumed: 2 } : null;
}
