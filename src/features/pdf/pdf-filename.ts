import type { SongDetails } from '../../types/domain';

const MAX_FILENAME_STEM_CODE_POINTS = 180;
const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*\u007f]/g;
const WINDOWS_RESERVED_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

function safePart(value: string): string {
  const withoutControls = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 ? ' ' : character;
  }).join('');
  const part = withoutControls.replace(INVALID_FILENAME_CHARACTERS, ' ').replace(/[. ]+$/g, '').trim().replace(/\s+/g, ' ');
  return WINDOWS_RESERVED_NAME.test(part) ? `_${part}` : part;
}

export function createPdfFilename(song: SongDetails): string {
  let stem = `${safePart(song.artist)} - ${safePart(song.title)}`.replace(/(?:\.pdf)+$/i, '').replace(/[. ]+$/g, '').trim();
  if (!stem || stem === '-') stem = 'Song';
  if (WINDOWS_RESERVED_NAME.test(stem)) stem = `_${stem}`;
  stem = Array.from(stem).slice(0, MAX_FILENAME_STEM_CODE_POINTS).join('').replace(/[. ]+$/g, '').trim();
  return `${stem || 'Song'}.pdf`;
}
