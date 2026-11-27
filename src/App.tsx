import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import PdfPreview from './features/preview/PdfPreview';
import { processSongInput } from './features/lyrics/validate-input';
import { PAPER_SIZES } from './features/paper/paper-sizes';
import { convertDimensionUnit, formatMillimetersInUnit, parseDimensionMillimeters } from './features/workspace/paper-units';
import { PdfGenerationError, type MeasurementUnit, type PdfSnapshot, type PaperSize, type SongProcessingInput, type ValidationIssue } from './types/domain';
import { useToast } from './components/ui/toast/useToast';

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

type PendingGenerationToast = {
  id: string;
  requestId: number;
  snapshot: PdfSnapshot | null;
  isUpdate: boolean;
};

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
  const { show: showToast, replace: replaceToast, dismiss: dismissToast } = useToast();
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
  const generationToastRef = useRef<PendingGenerationToast | null>(null);
  const wasStaleRef = useRef(false);

  const currentIdentity = inputIdentity(form);
  const isStale = snapshot !== null && (snapshotIdentity !== currentIdentity || snapshotNeedsRefresh);
  const fieldIssues = (field: ValidationIssue['field']) => issues.filter((issue) => issue.field === field);
  const isLoading = generationBusy;

  function cancelGenerationToast() {
    if (!generationToastRef.current) return;
    dismissToast(generationToastRef.current.id);
    generationToastRef.current = null;
  }

  useEffect(() => {
    if (isStale && !wasStaleRef.current) {
      showToast({
        variant: 'warning',
        title: 'Document needs updating',
        description: 'Update your PDF to apply your changes.',
        dedupeKey: 'document-stale',
      });
    }
    wasStaleRef.current = isStale;
  }, [isStale, showToast]);

  const handlePreviewReady = useCallback((readySnapshot: PdfSnapshot) => {
    const pending = generationToastRef.current;
    if (!pending || pending.snapshot !== readySnapshot || pending.requestId !== requestRef.current) return;
    replaceToast(pending.id, {
      variant: 'success',
      title: pending.isUpdate ? 'PDF updated' : 'PDF generated',
      description: pending.isUpdate ? 'Your updated PDF is ready.' : 'Your document is ready to download.',
    });
    generationToastRef.current = null;
  }, [replaceToast]);

  const handlePreviewError = useCallback((failedSnapshot: PdfSnapshot) => {
    const pending = generationToastRef.current;
    if (pending?.snapshot === failedSnapshot) {
      replaceToast(pending.id, {
        variant: 'error',
        title: 'Couldn’t load preview',
        description: 'Your PDF is still available. Retry the preview.',
      });
      generationToastRef.current = null;
      return;
    }
    showToast({
      variant: 'error',
      title: 'Couldn’t load preview',
      description: 'Your PDF is still available. Retry the preview.',
      dedupeKey: `preview-error:${failedSnapshot.filename}`,
    });
  }, [replaceToast, showToast]);

  const handleDownloadStarted = useCallback(() => {
    showToast({ variant: 'info', title: 'Download started', description: 'Your PDF download was handed to the browser.', dedupeKey: 'download-started' });
  }, [showToast]);

  const handleDownloadFailed = useCallback(() => {
    showToast({ variant: 'error', title: 'Couldn’t download PDF', description: 'The browser could not start the download. Try again.', dedupeKey: 'download-failed' });
  }, [showToast]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K], issueField?: ValidationIssue['field']) {
    cancelGenerationToast();
    requestRef.current += 1;
    revisionRef.current += 1;
    setForm((current) => ({ ...current, [key]: value }));
    setIssues((current) => issueField ? current.filter((issue) => issue.field !== issueField) : current);
    setWarnings([]);
    setGeneration((current) => current.status === 'loading' ? { status: 'idle' } : current);
  }

  function updateDimension(dimension: 'width' | 'height', value: string) {
    cancelGenerationToast();
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
    const toastId = showToast({
      variant: 'loading',
      title: 'Generating PDF',
      description: 'Preparing your printable document.',
      dedupeKey: `generation:${requestId}`,
    });
    generationToastRef.current = { id: toastId, requestId, snapshot: null, isUpdate: Boolean(snapshot) };
    generationBusyRef.current = true;
    setGenerationBusy(true);
    if (snapshot && snapshotIdentity === sourceIdentity) setSnapshotNeedsRefresh(true);
    try {
      const { generatePdf } = await import('./features/pdf/generate-pdf');
      const generated = await generatePdf(processed.data);
      if (requestRef.current !== requestId || revisionRef.current !== sourceRevision) return;
      if (generationToastRef.current?.requestId === requestId) generationToastRef.current.snapshot = generated;
      setSnapshot(generated);
      setSnapshotIdentity(sourceIdentity);
      setSnapshotNeedsRefresh(false);
      setGeneration({ status: 'idle' });
    } catch (error) {
      if (requestRef.current !== requestId || revisionRef.current !== sourceRevision) return;
      if (generationToastRef.current?.requestId === requestId) {
        replaceToast(generationToastRef.current.id, {
          variant: 'error',
          title: 'Couldn’t generate PDF',
          description: `${generationMessage(error)} Your lyrics are unchanged.`,
        });
        generationToastRef.current = null;
      }
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
    cancelGenerationToast();
    requestRef.current += 1;
    revisionRef.current += 1;
    setForm({ ...DEFAULT_FORM });
    setIssues([]);
    setWarnings([]);
    setSnapshot(null);
    setSnapshotIdentity(null);
    setSnapshotNeedsRefresh(false);
    setGeneration({ status: 'idle' });
    if (hasDraft) showToast({ variant: 'info', title: 'Editor reset', description: 'Your workspace has been cleared.', dedupeKey: 'editor-reset' });
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }

  const lyricsCount = Array.from(form.rawLyrics).length;
  const paperErrors = fieldIssues('paper');

  return (
    <div className="app-shell min-h-screen">
      <header className="masthead sticky top-4 z-50 mx-auto flex h-14 w-[calc(100%-2rem)] max-w-[1360px] items-center justify-between rounded-full border border-white/80 bg-white/85 px-1 shadow-sm backdrop-blur-2xl sm:top-6 sm:h-16 sm:w-full sm:px-6 xl:px-10">
        <a className="wordmark inline-flex items-center" href="#main" aria-label="Lyrie home">
          <img className="h-8 w-auto sm:h-9" src={`${import.meta.env.BASE_URL}brand/lyrie-logo.svg`} width="94" height="36" alt="" />
        </a>
      </header>

      <main className="workspace-main mx-auto w-full max-w-[1360px] px-4 pb-5 pt-8 sm:px-6 sm:pt-10 xl:px-10" id="main">
        <div className="page-intro mb-6 text-white sm:mb-9">
          <h1 className="m-0 text-[30px] font-extrabold leading-[1.15] tracking-[-0.04em] sm:text-[40px]">Lyrics made simple.</h1>
          <p className="mt-2 text-sm leading-6 sm:text-base">Turn your favorite lyrics into clean, print-ready PDFs.</p>
        </div>

        <div className="workspace-grid grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
          <section className="workspace-panel editor-panel min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="editor-heading" data-testid="editor-panel">
            <div className="mb-3 flex min-h-12 items-start justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold leading-[1.35] tracking-[-0.02em]" id="editor-heading">Document editor</h2>
                <p className="mt-1 text-[13px] leading-[1.45] text-muted">Add your song details and lyrics</p>
              </div>
              <button className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-lg px-1 text-[13px] font-semibold text-brand-blue hover:text-blue-hover hover:underline" type="button" aria-label="Reset form" onClick={resetForm}>
                <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" /><span>Reset</span>
              </button>
            </div>

            <form className="flex flex-col gap-3" noValidate onSubmit={handleGenerate}>
              {issues.length > 0 && (
                <div className="rounded-md border border-error bg-error-surface p-3 text-ink" role="alert" aria-labelledby="validation-title">
                  <h3 className="m-0 text-[13px] font-bold text-error" id="validation-title">Check these details</h3>
                  <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-xs leading-5">{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul>
                </div>
              )}

              <div className="flex min-w-0 flex-col gap-2">
                <label className="text-sm font-semibold leading-[1.4]" htmlFor="song-title">Song title</label>
                <input
                  className="h-12 w-full min-w-0 rounded-lg border border-control-border bg-surface px-3 text-sm text-ink transition-[border-color,box-shadow] placeholder:text-muted hover:border-muted focus-visible:border-brand-blue focus-visible:shadow-[0_0_0_2px_rgb(0_53_173_/_14%)] aria-[invalid=true]:border-error disabled:bg-disabled-surface disabled:text-disabled"
                  autoComplete="off"
                  id="song-title"
                  placeholder="Enter song title"
                  ref={titleInputRef}
                  name="title"
                  type="text"
                  value={form.title}
                  aria-invalid={fieldIssues('title').length > 0}
                  aria-describedby={fieldIssues('title').length ? issueId('title') : undefined}
                  onChange={(event) => updateForm('title', event.target.value, 'title')}
                />
                {fieldIssues('title').map((issue, index) => <p className="m-0 mt-px text-xs font-semibold leading-[1.45] text-error" id={issueId('title')} key={index}>{issue.message}</p>)}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <label className="text-sm font-semibold leading-[1.4]" htmlFor="artist">Artist</label>
                <input
                  className="h-12 w-full min-w-0 rounded-lg border border-control-border bg-surface px-3 text-sm text-ink transition-[border-color,box-shadow] placeholder:text-muted hover:border-muted focus-visible:border-brand-blue focus-visible:shadow-[0_0_0_2px_rgb(0_53_173_/_14%)] aria-[invalid=true]:border-error disabled:bg-disabled-surface disabled:text-disabled"
                  autoComplete="off"
                  id="artist"
                  placeholder="Enter artist name"
                  name="artist"
                  type="text"
                  value={form.artist}
                  aria-invalid={fieldIssues('artist').length > 0}
                  aria-describedby={fieldIssues('artist').length ? issueId('artist') : undefined}
                  onChange={(event) => updateForm('artist', event.target.value, 'artist')}
                />
                {fieldIssues('artist').map((issue, index) => <p className="m-0 mt-px text-xs font-semibold leading-[1.45] text-error" id={issueId('artist')} key={index}>{issue.message}</p>)}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <label className="text-sm font-semibold leading-[1.4]" htmlFor="lyrics">Lyrics</label>
                  <span className="text-xs tabular-nums text-muted">{lyricsCount.toLocaleString()} {lyricsCount === 1 ? 'character' : 'characters'}</span>
                </div>
                <textarea
                  className="min-h-[280px] w-full min-w-0 resize-y rounded-lg border border-control-border bg-canvas p-3 text-sm leading-[1.65] text-ink transition-[border-color,box-shadow] placeholder:text-muted hover:border-muted focus-visible:border-brand-blue focus-visible:shadow-[0_0_0_2px_rgb(0_53_173_/_14%)] aria-[invalid=true]:border-error disabled:bg-disabled-surface disabled:text-disabled"
                  id="lyrics"
                  name="lyrics"
                  placeholder={'Paste your lyrics here\n\n[Verse 1]\nYour first lines go here…'}
                  value={form.rawLyrics}
                  aria-invalid={fieldIssues('lyrics').length > 0}
                  aria-describedby={fieldIssues('lyrics').length ? issueId('lyrics') : undefined}
                  onChange={(event) => updateForm('rawLyrics', event.target.value, 'lyrics')}
                  spellCheck="false"
                />
                {fieldIssues('lyrics').map((issue, index) => <p className="m-0 mt-px text-xs font-semibold leading-[1.45] text-error" id={issueId('lyrics')} key={index}>{issue.message}</p>)}
              </div>

              <fieldset className="flex min-w-0 flex-col gap-2 rounded-xl border-0 bg-tint p-3">
                <legend className="sr-only">Paper settings</legend>
                <label className="text-sm font-semibold leading-[1.4]" htmlFor="paper-size">Paper size</label>
                <select
                  className="h-[42px] w-full min-w-0 rounded-lg border border-control-border bg-surface px-3 pr-8 text-sm text-ink transition-[border-color,box-shadow] hover:border-muted focus-visible:border-brand-blue focus-visible:shadow-[0_0_0_2px_rgb(0_53_173_/_14%)] aria-[invalid=true]:border-error disabled:bg-disabled-surface disabled:text-disabled"
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
                  <div className="mt-1 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_76px] gap-2 max-[639px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_68px]">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label className="text-xs font-semibold" htmlFor="custom-width">Width</label>
                      <input
                        className="h-[42px] w-full min-w-0 rounded-lg border border-control-border bg-surface px-2.5 text-[13px] text-ink focus-visible:border-brand-blue aria-[invalid=true]:border-error"
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
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label className="text-xs font-semibold" htmlFor="custom-height">Height</label>
                      <input
                        className="h-[42px] w-full min-w-0 rounded-lg border border-control-border bg-surface px-2.5 text-[13px] text-ink focus-visible:border-brand-blue aria-[invalid=true]:border-error"
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
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label className="text-xs font-semibold" htmlFor="measurement-unit">Unit</label>
                      <select className="h-[42px] w-full rounded-lg border border-control-border bg-surface px-2.5 text-[13px] text-ink focus-visible:border-brand-blue" id="measurement-unit" aria-label="Measurement unit" value={form.unit} onChange={(event) => changeUnit(event.target.value as MeasurementUnit)}>
                        <option value="mm">mm</option>
                        <option value="in">in</option>
                      </select>
                    </div>
                  </div>
                )}
                {paperErrors.length > 0 && <div id={issueId('paper')} className="grid gap-1">{paperErrors.map((issue, index) => <p className="m-0 mt-px text-xs font-semibold leading-[1.45] text-error" key={index}>{issue.message}</p>)}</div>}
                <p className="m-0 mt-px text-xs leading-[1.5] text-muted">Portrait pages with the print margins already set.</p>
              </fieldset>

              {warnings.length > 0 && <p className="m-0 rounded-md bg-warning-surface px-3 py-2.5 text-xs leading-[1.5] text-warning" role="status">{warnings.join(' ')}</p>}

              <div className="mt-0.5 flex items-center gap-4">
                <button className="primary-button inline-flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-lg border border-brand-blue bg-brand-blue px-5 text-sm font-bold text-white transition-colors hover:border-blue-hover hover:bg-blue-hover active:border-blue-pressed active:bg-blue-pressed disabled:cursor-wait disabled:border-disabled disabled:bg-disabled" type="submit" disabled={isLoading}>
                  {isLoading ? <><LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" />Generating your PDF…</> : snapshot && isStale ? 'Update PDF' : generation.status === 'error' ? 'Try again' : 'Generate PDF'}
                </button>
              </div>
            </form>
          </section>

          <section className="workspace-panel preview-panel min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="preview-heading" data-testid="preview-panel">
            <PdfPreview
              snapshot={snapshot}
              stale={isStale}
              generationStatus={generation.status}
              generationError={generation.status === 'error' ? generation.message : undefined}
              onPreviewReady={handlePreviewReady}
              onPreviewError={handlePreviewError}
              onDownloadStarted={handleDownloadStarted}
              onDownloadFailed={handleDownloadFailed}
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

        <footer className="workspace-footer pt-4">
          <p className="m-0 text-xs leading-[1.5] text-muted">Your lyrics are processed in this browser and are not saved.</p>
        </footer>
      </main>
    </div>
  );
}
