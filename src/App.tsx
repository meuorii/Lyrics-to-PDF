import { useRef, useState, type FormEvent } from 'react';
import {
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import PdfPreview from './features/preview/PdfPreview';
import { processSongInput } from './features/lyrics/validate-input';
import { PAPER_SIZES } from './features/paper/paper-sizes';
import { convertDimensionUnit, formatMillimetersInUnit, parseDimensionMillimeters } from './features/workspace/paper-units';
import { PdfGenerationError, type MeasurementUnit, type PdfSnapshot, type PaperSize, type SongProcessingInput, type ValidationIssue } from './types/domain';

type FormState = {
  title: string;
  artist: string;
  rawLyrics: string;
  paperSize: PaperSize;
  customWidth: string;
  customHeight: string;
  customWidthMm: number | null;
  customHeightMm: number | null;
  unit: MeasurementUnit;
};

type GenerationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };

const DEFAULT_FORM: FormState = {
  title: '',
  artist: '',
  rawLyrics: '',
  paperSize: 'A4',
  customWidth: '210',
  customHeight: '297',
  customWidthMm: 210,
  customHeightMm: 297,
  unit: 'mm',
};

const PAPER_OPTIONS: Array<{ value: PaperSize; label: string }> = [
  ...(Object.keys(PAPER_SIZES) as Array<Exclude<PaperSize, 'Custom'>>).map((value) => ({
    value,
    label: value === 'Letter' ? 'Letter / Short' : value,
  })),
  { value: 'Custom', label: 'Custom dimensions' },
];

function paperInputDimension(rawValue: string, unit: MeasurementUnit, canonicalMm: number | null): number | undefined {
  if (canonicalMm !== null) return canonicalMm;
  if (rawValue.trim() === '') return undefined;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return Number.NaN;
  return unit === 'in' ? value * 25.4 : value;
}

function paperSelection(form: FormState): SongProcessingInput['paper'] {
  if (form.paperSize !== 'Custom') return { size: form.paperSize };
  return {
    size: 'Custom',
    custom: {
      width: paperInputDimension(form.customWidth, form.unit, form.customWidthMm),
      height: paperInputDimension(form.customHeight, form.unit, form.customHeightMm),
      unit: 'mm',
    },
  };
}

function inputIdentity(form: FormState): string {
  const paper = form.paperSize === 'Custom'
    ? ['Custom', form.customWidthMm ?? `${form.customWidth}:${form.unit}`, form.customHeightMm ?? `${form.customHeight}:${form.unit}`]
    : [form.paperSize];
  return JSON.stringify([form.title, form.artist, form.rawLyrics, paper]);
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
}

function generationMessage(error: unknown): string {
  if (error instanceof PdfGenerationError && error.code === 'unsupported-glyph') {
    return 'A required character is unsupported. Review the text and try again.';
  }
  if (error instanceof PdfGenerationError && error.code === 'font-loading') {
    return 'PDF font assets could not be loaded. Your text is still here; try again.';
  }
  if (error instanceof PdfGenerationError && error.code === 'invalid-geometry') {
    return 'The selected paper cannot fit the document. Check the paper dimensions and try again.';
  }
  return 'Document generation could not finish. Your text is still here; try again.';
}

function issueId(field: ValidationIssue['field']): string {
  return `${field}-error`;
}

export default function App() {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [generation, setGeneration] = useState<GenerationState>({ status: 'idle' });
  const [snapshot, setSnapshot] = useState<PdfSnapshot | null>(null);
  const [snapshotIdentity, setSnapshotIdentity] = useState<string | null>(null);
  const [snapshotNeedsRefresh, setSnapshotNeedsRefresh] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const revisionRef = useRef(0);
  const requestRef = useRef(0);
  const generationBusyRef = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const currentIdentity = inputIdentity(form);
  const isStale = snapshot !== null && (snapshotIdentity !== currentIdentity || snapshotNeedsRefresh);
  const fieldIssues = (field: ValidationIssue['field']) => issues.filter((issue) => issue.field === field);
  const isLoading = generationBusy;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K], issueField?: ValidationIssue['field']) {
    requestRef.current += 1;
    revisionRef.current += 1;
    setForm((current) => ({ ...current, [key]: value }));
    setIssues((current) => issueField ? current.filter((issue) => issue.field !== issueField) : current);
    setWarnings([]);
    setGeneration((current) => current.status === 'loading' ? { status: 'idle' } : current);
  }

  function updateDimension(dimension: 'width' | 'height', value: string) {
    requestRef.current += 1;
    revisionRef.current += 1;
    setIssues((current) => current.filter((issue) => issue.field !== 'paper'));
    setWarnings([]);
    setGeneration((current) => current.status === 'loading' ? { status: 'idle' } : current);
    setForm((current) => dimension === 'width'
      ? { ...current, customWidth: value, customWidthMm: parseDimensionMillimeters(value, current.unit) }
      : { ...current, customHeight: value, customHeightMm: parseDimensionMillimeters(value, current.unit) });
  }

  function changeUnit(unit: MeasurementUnit) {
    if (unit === form.unit) return;
    setIssues((current) => current.filter((issue) => issue.field !== 'paper'));
    setWarnings([]);
    setForm((current) => ({
      ...current,
      unit,
      customWidth: current.customWidthMm === null
        ? convertDimensionUnit(current.customWidth, current.unit, unit)
        : formatMillimetersInUnit(current.customWidthMm, unit),
      customHeight: current.customHeightMm === null
        ? convertDimensionUnit(current.customHeight, current.unit, unit)
        : formatMillimetersInUnit(current.customHeightMm, unit),
    }));
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generationBusyRef.current) return;
    const input: SongProcessingInput = {
      title: form.title,
      artist: form.artist,
      rawLyrics: form.rawLyrics,
      paper: paperSelection(form),
    };
    const processed = processSongInput(input);
    setWarnings(processed.warnings.map((warning) => warning.code === 'genius-artifact-removed'
      ? 'A standalone Genius link was removed during cleanup.'
      : 'Some non-lyric page text was removed.'));
    if (!processed.success) {
      setIssues(processed.issues);
      setGeneration({ status: 'idle' });
      const firstField = processed.issues[0]?.field;
      const firstId = firstField === 'paper'
        ? form.paperSize === 'Custom' ? 'custom-width' : 'paper-size'
        : firstField === 'title' ? 'song-title' : firstField;
      if (firstId) requestAnimationFrame(() => document.getElementById(firstId)?.focus());
      return;
    }

    setIssues([]);
    const requestId = ++requestRef.current;
    const sourceRevision = revisionRef.current;
    const sourceIdentity = currentIdentity;
    setGeneration({ status: 'loading' });
    generationBusyRef.current = true;
    setGenerationBusy(true);
    if (snapshot && snapshotIdentity === sourceIdentity) setSnapshotNeedsRefresh(true);
    try {
      const { generatePdf } = await import('./features/pdf/generate-pdf');
      const generated = await generatePdf(processed.data);
      if (requestRef.current !== requestId || revisionRef.current !== sourceRevision) return;
      setSnapshot(generated);
      setSnapshotIdentity(sourceIdentity);
      setSnapshotNeedsRefresh(false);
      setGeneration({ status: 'idle' });
    } catch (error) {
      if (requestRef.current !== requestId || revisionRef.current !== sourceRevision) return;
      setGeneration({ status: 'error', message: generationMessage(error) });
    } finally {
      generationBusyRef.current = false;
      setGenerationBusy(false);
    }
  }

  function resetForm() {
    const hasDraft = Boolean(
      form.title.trim() || form.artist.trim() || form.rawLyrics.trim() || snapshot || form.paperSize !== 'A4'
      || form.customWidth !== DEFAULT_FORM.customWidth || form.customHeight !== DEFAULT_FORM.customHeight || form.unit !== DEFAULT_FORM.unit,
    );
    if (hasDraft && !window.confirm('Clear the song details, lyrics, paper settings, and generated PDF?')) return;
    requestRef.current += 1;
    revisionRef.current += 1;
    setForm({ ...DEFAULT_FORM });
    setIssues([]);
    setWarnings([]);
    setSnapshot(null);
    setSnapshotIdentity(null);
    setSnapshotNeedsRefresh(false);
    setGeneration({ status: 'idle' });
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }

  const lyricsCount = Array.from(form.rawLyrics).length;
  const paperErrors = fieldIssues('paper');

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-inner">
          <a className="wordmark" href="#main" aria-label="Lyrie home">
            <img src={`${import.meta.env.BASE_URL}brand/lyrie-logo.svg`} width="94" height="36" alt="" />
          </a>
          <p className="privacy-note"><span className="privacy-dot" aria-hidden="true" />Private by design</p>
        </div>
      </header>

      <main className="workspace-main" id="main">
        <div className="page-intro">
          <h1>Lyrics made simple.</h1>
          <p>Turn your favorite lyrics into clean, print-ready PDFs.</p>
        </div>

        <div className="workspace-grid">
          <section className="workspace-panel editor-panel" aria-labelledby="editor-heading" data-testid="editor-panel">
            <div className="panel-heading editor-heading">
              <div>
                <h2 id="editor-heading">Document editor</h2>
                <p>Song details, paper and lyrics</p>
              </div>
              <button className="reset-button" type="button" onClick={resetForm}>
                <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" />Reset form
              </button>
            </div>

            <form className="editor-form" noValidate onSubmit={handleGenerate}>
              {issues.length > 0 && (
                <div className="validation-summary" role="alert" aria-labelledby="validation-title">
                  <h3 id="validation-title">Check these details</h3>
                  <ul>{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul>
                </div>
              )}

              <div className="field-group">
                <label htmlFor="song-title">Song title</label>
                <input
                  autoComplete="off"
                  id="song-title"
                  ref={titleInputRef}
                  name="title"
                  type="text"
                  value={form.title}
                  aria-invalid={fieldIssues('title').length > 0}
                  aria-describedby={fieldIssues('title').length ? issueId('title') : undefined}
                  onChange={(event) => updateForm('title', event.target.value, 'title')}
                />
                {fieldIssues('title').map((issue, index) => <p className="field-error" id={issueId('title')} key={index}>{issue.message}</p>)}
              </div>

              <div className="field-group">
                <label htmlFor="artist">Artist</label>
                <input
                  autoComplete="off"
                  id="artist"
                  name="artist"
                  type="text"
                  value={form.artist}
                  aria-invalid={fieldIssues('artist').length > 0}
                  aria-describedby={fieldIssues('artist').length ? issueId('artist') : undefined}
                  onChange={(event) => updateForm('artist', event.target.value, 'artist')}
                />
                {fieldIssues('artist').map((issue, index) => <p className="field-error" id={issueId('artist')} key={index}>{issue.message}</p>)}
              </div>

              <fieldset className="field-group paper-fields">
                <legend>Paper</legend>
                <label htmlFor="paper-size">Paper size</label>
                <select
                  id="paper-size"
                  name="paper"
                  value={form.paperSize}
                  aria-invalid={paperErrors.length > 0}
                  aria-describedby={paperErrors.length ? issueId('paper') : undefined}
                  onChange={(event) => updateForm('paperSize', event.target.value as PaperSize, 'paper')}
                >
                  {PAPER_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
                {form.paperSize === 'Custom' && (
                  <div className="custom-paper-fields">
                    <div className="dimension-field">
                      <label htmlFor="custom-width">Width</label>
                      <input
                        id="custom-width"
                        name="width"
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={form.customWidth}
                        aria-invalid={paperErrors.length > 0}
                        aria-describedby={paperErrors.length ? issueId('paper') : undefined}
                        onChange={(event) => updateDimension('width', event.target.value)}
                      />
                    </div>
                    <div className="dimension-field">
                      <label htmlFor="custom-height">Height</label>
                      <input
                        id="custom-height"
                        name="height"
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={form.customHeight}
                        aria-invalid={paperErrors.length > 0}
                        aria-describedby={paperErrors.length ? issueId('paper') : undefined}
                        onChange={(event) => updateDimension('height', event.target.value)}
                      />
                    </div>
                    <div className="dimension-field unit-field">
                      <label htmlFor="measurement-unit">Unit</label>
                      <select id="measurement-unit" aria-label="Measurement unit" value={form.unit} onChange={(event) => changeUnit(event.target.value as MeasurementUnit)}>
                        <option value="mm">mm</option>
                        <option value="in">in</option>
                      </select>
                    </div>
                  </div>
                )}
                {paperErrors.length > 0 && <div id={issueId('paper')} className="field-errors">{paperErrors.map((issue, index) => <p className="field-error" key={index}>{issue.message}</p>)}</div>}
                <p className="field-hint">Portrait pages with the print margins already set.</p>
              </fieldset>

              <div className="field-group lyrics-field">
                <div className="label-row">
                  <label htmlFor="lyrics">Lyrics</label>
                  <span className="character-count">{lyricsCount.toLocaleString()} {lyricsCount === 1 ? 'character' : 'characters'}</span>
                </div>
                <textarea
                  id="lyrics"
                  name="lyrics"
                  placeholder={'Paste your lyrics here\n\n[Verse 1]\nYour first lines go here…'}
                  value={form.rawLyrics}
                  aria-invalid={fieldIssues('lyrics').length > 0}
                  aria-describedby={fieldIssues('lyrics').length ? issueId('lyrics') : undefined}
                  onChange={(event) => updateForm('rawLyrics', event.target.value, 'lyrics')}
                  spellCheck="false"
                />
                {fieldIssues('lyrics').map((issue, index) => <p className="field-error" id={issueId('lyrics')} key={index}>{issue.message}</p>)}
              </div>

              {warnings.length > 0 && <p className="warning-message" role="status">{warnings.join(' ')}</p>}

              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isLoading}>
                  {isLoading ? <><LoaderCircle size={17} className="spin-icon" aria-hidden="true" />Generating your PDF…</> : snapshot && isStale ? 'Update PDF' : generation.status === 'error' ? 'Try again' : 'Generate PDF'}
                </button>
              </div>
            </form>
          </section>

          <section className="workspace-panel preview-panel" aria-labelledby="preview-heading" data-testid="preview-panel">
            <PdfPreview
              snapshot={snapshot}
              stale={isStale}
              generationStatus={generation.status}
              generationError={generation.status === 'error' ? generation.message : undefined}
            />
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" aria-label="PDF document status">
              {generation.status === 'loading' && 'Creating PDF.'}
              {generation.status === 'error' && 'PDF creation failed. Your input is preserved.'}
              {generation.status === 'idle' && snapshot && !isStale && `PDF generated. ${snapshot.pageCount} ${snapshot.pageCount === 1 ? 'page' : 'pages'}. ${formatBytes(snapshot.blob.size)}.`}
              {generation.status === 'idle' && isStale && 'PDF is out of date.'}
              {generation.status === 'idle' && !snapshot && 'No PDF has been generated.'}
            </div>
          </section>
        </div>

        <footer className="workspace-footer">
          <p>Your lyrics are processed in this browser and are not saved.</p>
        </footer>
      </main>
    </div>
  );
}
