export type SongDetails = {
  title: string;
  artist: string;
};

export type LyricsInput = {
  rawText: string;
};

export type LyricsSection = {
  label: string | null;
  lines: string[];
};

export type NormalizedLyrics = {
  rawText: string;
  text: string;
  sections: LyricsSection[];
  warnings: NormalizationWarning[];
};

export type NormalizationWarning = {
  code: 'genius-artifact-removed';
  line: string;
};

export type PaperSize =
  | 'A3'
  | 'A4'
  | 'A5'
  | 'A6'
  | 'B4'
  | 'B5'
  | 'Letter'
  | 'Long Bond'
  | 'Legal'
  | 'Custom';

export type PaperDimensions = {
  width: number;
  height: number;
  unit: 'mm';
};

export type MeasurementUnit = 'mm' | 'in';

export type PaperSelection =
  | { size: Exclude<PaperSize, 'Custom'> }
  | { size: 'Custom'; custom?: { width?: number; height?: number; unit?: MeasurementUnit } };

export type ResolvedPaperDimensions = PaperDimensions & { size: PaperSize };

export type PaperGeometry = {
  valid: boolean;
  issues: ValidationIssue[];
  columnWidthPt: number;
  usableBodyHeightPt: number;
};

export type PdfLayoutConfig = {
  paperSize: PaperSize;
  orientation: 'portrait';
  marginMm: number;
  columnGapMm: number;
  columnCount: 2;
  titleFontSizePt: number;
  artistFontSizePt: number;
  lyricsFontSizePt: number;
  sectionLabelFontSizePt: number;
  lineHeight: number;
  paragraphSpacingPt: number;
  sectionSeparationBlankLines: 1;
  fontFamily: string;
  textColor: '#000000';
  backgroundColor: '#FFFFFF';
};

export type PdfGenerationInput = {
  song: SongDetails;
  lyrics: LyricsInput;
  layout: PdfLayoutConfig;
};

export type PdfGenerationResult = {
  blob: Blob;
  bytes: Uint8Array;
};

export type PdfPreviewState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'ready'; pageCount: number; byteLength: number }
  | { status: 'error'; message: string };

export type ValidationIssue = {
  field: 'title' | 'artist' | 'lyrics' | 'paper';
  message: string;
};

export type SongProcessingInput = {
  title: string;
  artist: string;
  rawLyrics: string;
  paper: PaperSelection;
};

export type ValidatedSong = {
  song: SongDetails;
  rawLyrics: LyricsInput;
  lyrics: NormalizedLyrics;
  paper: ResolvedPaperDimensions;
  geometry: PaperGeometry;
};

export type SongProcessingResult =
  | { success: true; data: ValidatedSong; warnings: NormalizationWarning[] }
  | { success: false; issues: ValidationIssue[]; warnings: NormalizationWarning[] };
