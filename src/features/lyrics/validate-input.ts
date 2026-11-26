import type { NormalizedLyrics, PaperGeometry, SongProcessingInput, SongProcessingResult, ValidationIssue } from '../../types/domain';
import { normalizeLyrics } from './normalize-lyrics';
import { resolvePaperDimensions, validatePaperGeometry } from '../paper/paper-dimensions';

const MEANINGFUL_METADATA = /[^\s\p{Cf}]/u;

export function validateMetadata(metadata: { title: string; artist: string }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!MEANINGFUL_METADATA.test(metadata.title)) issues.push({ field: 'title', message: 'Enter a song title.' });
  if (!MEANINGFUL_METADATA.test(metadata.artist)) issues.push({ field: 'artist', message: 'Enter an artist name.' });
  return issues;
}

export function validateLyrics(value: string | NormalizedLyrics): ValidationIssue[] {
  const normalized = typeof value === 'string' ? normalizeLyrics(value) : value;
  const hasBody = normalized.sections.some(({ lines }) => lines.some((line) => /[^\s\p{Cf}]/u.test(line)));
  return hasBody ? [] : [{ field: 'lyrics', message: normalized.sections.some(({ label }) => label !== null) ? 'Add lyric content after the section labels.' : 'Enter lyrics.' }];
}

export function processSongInput(input: SongProcessingInput): SongProcessingResult {
  const metadataIssues = validateMetadata(input);
  const lyrics = normalizeLyrics(input.rawLyrics);
  const lyricsIssues = validateLyrics(lyrics);
  const paper = resolvePaperDimensions(input.paper);
  const issues = [...metadataIssues, ...lyricsIssues, ...(paper.ok ? [] : paper.issues)];
  if (!paper.ok) return { success: false, issues, warnings: lyrics.warnings };
  const geometry: PaperGeometry = validatePaperGeometry(paper.dimensions);
  issues.push(...geometry.issues);
  if (issues.length) return { success: false, issues, warnings: lyrics.warnings };
  return {
    success: true,
    data: {
      song: { title: input.title, artist: input.artist },
      rawLyrics: { rawText: input.rawLyrics },
      lyrics,
      paper: paper.dimensions,
      geometry,
    },
    warnings: lyrics.warnings,
  };
}
