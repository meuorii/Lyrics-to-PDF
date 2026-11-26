const SUPPORTED_LABEL = /^\[\s*(Intro|Verse(?:\s+\d+)?|Pre-Chorus|Chorus|Post-Chorus|Bridge|Refrain|Outro|Instrumental(?:\s+Break)?|Interlude)(?:\s*:\s*[^\]\r\n]+)?\s*\]$/i;

export type ParsedSectionLabel = { label: string; hasPerformerSuffix: boolean };

export function parseSectionLabel(line: string): ParsedSectionLabel | null {
  const match = SUPPORTED_LABEL.exec(line.trim());
  if (!match) return null;
  const inside = match[0].slice(1, -1).trim();
  const colon = inside.indexOf(':');
  return {
    label: `[${(colon < 0 ? inside : inside.slice(0, colon)).trim()}]`,
    hasPerformerSuffix: colon >= 0,
  };
}
