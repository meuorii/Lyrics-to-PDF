import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FileText,
  LoaderCircle,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { downloadPdf } from './download-pdf';
import {
  calculateCanvasResolution,
  canZoom,
  fitScale,
  getZoomPercent,
  manualZoomScale,
  type FitMode,
  type ZoomDirection,
} from './preview-scale';
import type { PdfSnapshot } from '../../types/domain';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from 'pdfjs-dist';

type PreviewStatus =
  | { status: 'empty' }
  | { status: 'loading-document' }
  | { status: 'rendering-page'; pageNumber: number }
  | { status: 'ready'; pageNumber: number }
  | { status: 'error'; stage: 'loading' | 'rendering'; message: string };

type ViewportSize = { width: number; height: number; devicePixelRatio: number };
type RenderedPage = { snapshot: PdfSnapshot; pageNumber: number; revision: number };
type GenerationStatus = 'idle' | 'loading' | 'error';

type PdfPreviewProps = {
  snapshot: PdfSnapshot | null;
  stale: boolean;
  generationStatus: GenerationStatus;
  generationError?: string;
};

type PreviewResources = {
  loadingTask: MutableRefObject<PDFDocumentLoadingTask | null>;
  document: MutableRefObject<PDFDocumentProxy | null>;
  renderTask: MutableRefObject<RenderTask | null>;
  renderWork: MutableRefObject<Promise<void>>;
  textLayer: MutableRefObject<TextLayer | null>;
  textLayerWork: MutableRefObject<Promise<unknown> | null>;
  page: MutableRefObject<PDFPageProxy | null>;
  renderRevision: MutableRefObject<number>;
  canvas: MutableRefObject<HTMLCanvasElement | null>;
  textLayerElement: MutableRefObject<HTMLDivElement | null>;
  runtime: MutableRefObject<typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null>;
};

function isExpectedCancellation(error: unknown): boolean {
  return error instanceof Error && (error.name === 'RenderingCancelledException' || error.name === 'AbortException');
}

function reportCleanupFailure(error: unknown): void {
  if (!isExpectedCancellation(error)) console.error('PDF preview resources could not be fully released.', error);
}

function reportRenderQueueFailure(error: unknown): void {
  if (!isExpectedCancellation(error)) console.error('A prior PDF page render did not settle cleanly.', error);
}

async function disposePreviewResources(resources: PreviewResources): Promise<void> {
  resources.renderRevision.current += 1;
  resources.renderTask.current?.cancel();
  resources.textLayer.current?.cancel();
  await Promise.all([
    resources.renderWork.current,
    resources.textLayerWork.current?.catch((error: unknown) => {
      if (!isExpectedCancellation(error)) throw error;
    }) ?? Promise.resolve(),
  ]);

  resources.renderTask.current = null;
  resources.textLayer.current = null;
  resources.page.current?.cleanup();
  resources.page.current = null;
  const loadingTask = resources.loadingTask.current;
  resources.loadingTask.current = null;
  resources.document.current = null;
  if (loadingTask) await loadingTask.destroy();

  const canvas = resources.canvas.current;
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
  resources.textLayerElement.current?.replaceChildren();
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
}

function paperLabel(snapshot: PdfSnapshot): string {
  if (snapshot.paper.size !== 'Custom') return snapshot.paper.size;
  const width = Number(snapshot.paper.width.toFixed(1));
  const height = Number(snapshot.paper.height.toFixed(1));
  return `${width} × ${height} mm`;
}

function focusableElements(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((item) => item.getAttribute('aria-hidden') !== 'true');
}

export default function PdfPreview({ snapshot, stale, generationStatus, generationError }: PdfPreviewProps) {
  const [previewState, setPreviewState] = useState<PreviewStatus>({ status: 'empty' });
  const [pageCount, setPageCount] = useState(0);
  const [loadedSnapshot, setLoadedSnapshot] = useState<PdfSnapshot | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomMode, setZoomMode] = useState<FitMode | 'manual'>('page');
  const [manualScale, setManualScale] = useState(1);
  const [effectiveScale, setEffectiveScale] = useState(0);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0, devicePixelRatio: 1 });
  const viewportSizeRef = useRef<ViewportSize>({ width: 0, height: 0, devicePixelRatio: 1 });
  const [documentRevision, setDocumentRevision] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [renderedPage, setRenderedPage] = useState<RenderedPage | null>(null);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState('');
  const isExpanded = fallbackFullscreen || nativeFullscreen;

  const previewRootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerElementRef = useRef<HTMLDivElement>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const loadedSnapshotRef = useRef<PdfSnapshot | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderWorkRef = useRef<Promise<void>>(Promise.resolve());
  const textLayerRef = useRef<TextLayer | null>(null);
  const textLayerWorkRef = useRef<Promise<unknown> | null>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const renderRevisionRef = useRef(0);
  const documentRevisionRef = useRef(0);
  const runtimeRef = useRef<PreviewResources['runtime']['current']>(null);
  const disposalQueueRef = useRef<Promise<void>>(Promise.resolve());
  const effectiveScaleRef = useRef(0);
  const renderedSnapshotRef = useRef<PdfSnapshot | null>(null);
  const currentSnapshotRef = useRef(snapshot);
  const currentStaleRef = useRef(stale);
  const generationStatusRef = useRef(generationStatus);
  const readyPageRef = useRef(0);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    currentSnapshotRef.current = snapshot;
    currentStaleRef.current = stale;
    generationStatusRef.current = generationStatus;
  }, [snapshot, stale, generationStatus]);

  const resources = useMemo<PreviewResources>(() => ({
    loadingTask: loadingTaskRef,
    document: documentRef,
    renderTask: renderTaskRef,
    renderWork: renderWorkRef,
    textLayer: textLayerRef,
    textLayerWork: textLayerWorkRef,
    page: pageRef,
    renderRevision: renderRevisionRef,
    canvas: canvasRef,
    textLayerElement: textLayerElementRef,
    runtime: runtimeRef,
  }), []);

  const enqueueDisposal = useCallback((): Promise<void> => {
    const next = disposalQueueRef.current.then(
      () => disposePreviewResources(resources),
      () => disposePreviewResources(resources),
    );
    disposalQueueRef.current = next;
    return next;
  }, [resources]);

  const cancelCurrentRender = useCallback(() => {
    renderRevisionRef.current += 1;
    readyPageRef.current = 0;
    renderedSnapshotRef.current = null;
    setRenderedPage(null);
    renderTaskRef.current?.cancel();
    textLayerRef.current?.cancel();
    textLayerElementRef.current?.replaceChildren();
  }, []);

  useEffect(() => {
    let active = true;
    const revision = ++documentRevisionRef.current;

    if (!snapshot) {
      // Reset viewer state when its externally owned snapshot is removed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewState({ status: 'empty' });
      setPageCount(0);
      setLoadedSnapshot(null);
      setPageNumber(1);
      setZoomMode('page');
      setEffectiveScale(0);
      setRenderedPage(null);
      readyPageRef.current = 0;
      renderedSnapshotRef.current = null;
      void enqueueDisposal().catch(reportCleanupFailure);
      return () => {
        active = false;
        documentRevisionRef.current += 1;
        void enqueueDisposal().catch(reportCleanupFailure);
      };
    }

    setPreviewState({ status: 'loading-document' });
    setPageCount(0);
    setLoadedSnapshot(null);
    setPageNumber(1);
    setZoomMode('page');
    setManualScale(1);
    setEffectiveScale(0);
    setRenderedPage(null);
    readyPageRef.current = 0;
    renderedSnapshotRef.current = null;
    textLayerElementRef.current?.replaceChildren();

    const loadDocument = async () => {
      try {
        await disposalQueueRef.current;
        if (!active || documentRevisionRef.current !== revision) return;
        await import('pdfjs-dist/web/pdf_viewer.css');
        const { pdfjs } = await import('./pdfjs-runtime');
        runtimeRef.current = pdfjs;
        if (!active || documentRevisionRef.current !== revision) return;

        const loadingTask = pdfjs.getDocument({ data: snapshot.bytes });
        loadingTaskRef.current = loadingTask;
        const document = await loadingTask.promise;
        if (!active || documentRevisionRef.current !== revision || currentSnapshotRef.current !== snapshot) return;
        if (document.numPages !== snapshot.pageCount) {
          throw new Error('The generated PDF page count did not match its verified snapshot.');
        }

        documentRef.current = document;
        loadedSnapshotRef.current = snapshot;
        setPageCount(document.numPages);
        setLoadedSnapshot(snapshot);
        setDocumentRevision(revision);
      } catch (error) {
        if (active && documentRevisionRef.current === revision && !isExpectedCancellation(error)) {
          setPreviewState({
            status: 'error',
            stage: 'loading',
            message: 'Your generated document and original lyrics are still available. Retry the preview.',
          });
        }
      }
    };

    void loadDocument();
    return () => {
      active = false;
      documentRevisionRef.current += 1;
      void enqueueDisposal().catch(reportCleanupFailure);
    };
  }, [snapshot, loadAttempt, enqueueDisposal]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const rect = viewport.getBoundingClientRect();
      const style = getComputedStyle(viewport);
      const width = Math.max(0, rect.width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight));
      const height = Math.max(0, rect.height - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom));
      const devicePixelRatio = window.devicePixelRatio || 1;
      const current = viewportSizeRef.current;
      const changed = Math.abs(current.width - width) > 1 || Math.abs(current.height - height) > 1 || current.devicePixelRatio !== devicePixelRatio;
      if (!changed) return;
      const next = { width, height, devicePixelRatio };
      viewportSizeRef.current = next;
      if ((zoomMode !== 'manual' || current.devicePixelRatio !== devicePixelRatio) && documentRef.current) {
        cancelCurrentRender();
        setPreviewState({ status: 'rendering-page', pageNumber });
      }
      setViewportSize(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [zoomMode, pageNumber, fallbackFullscreen, cancelCurrentRender]);

  useEffect(() => {
    const document = documentRef.current;
    if (!document || loadedSnapshotRef.current !== snapshot || !snapshot || viewportSize.width <= 0 || viewportSize.height <= 0) return;

    let active = true;
    const revision = ++renderRevisionRef.current;
    readyPageRef.current = 0;
    renderedSnapshotRef.current = null;
    setRenderedPage(null);
    setPreviewState({ status: 'rendering-page', pageNumber });
    textLayerElementRef.current?.replaceChildren();

    const isCurrent = () => active
      && renderRevisionRef.current === revision
      && documentRef.current === document
      && loadedSnapshotRef.current === snapshot
      && currentSnapshotRef.current === snapshot;

    const renderPage = async () => {
      try {
        if (!isCurrent()) return;

        const page = await document.getPage(pageNumber);
        if (!isCurrent()) {
          page.cleanup();
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = zoomMode === 'manual'
          ? manualScale
          : fitScale(baseViewport.width, baseViewport.height, viewportSize.width, viewportSize.height, zoomMode);
        if (scale === null || !Number.isFinite(scale) || scale <= 0) throw new Error('The preview area has no usable dimensions.');

        const viewport = page.getViewport({ scale });
        const resolution = calculateCanvasResolution(viewport.width, viewport.height, viewportSize.devicePixelRatio);
        if (!resolution) throw new Error('The PDF page dimensions exceed the safe preview limits.');

        const canvas = canvasRef.current;
        const textLayerElement = textLayerElementRef.current;
        const context = canvas?.getContext('2d', { alpha: false });
        if (!canvas || !textLayerElement || !context) throw new Error('The browser could not create a PDF preview canvas.');

        canvas.width = resolution.width;
        canvas.height = resolution.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textLayerElement.style.width = `${viewport.width}px`;
        textLayerElement.style.height = `${viewport.height}px`;

        const { pdfjs } = await import('./pdfjs-runtime');
        if (!isCurrent()) {
          page.cleanup();
          return;
        }
        const textContent = await page.getTextContent();
        if (!isCurrent()) {
          page.cleanup();
          return;
        }

        const textLayer = new pdfjs.TextLayer({ textContentSource: textContent, container: textLayerElement, viewport });
        textLayerRef.current = textLayer;
        const textWork = textLayer.render();
        textLayerWorkRef.current = textWork;
        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: [resolution.outputScale, 0, 0, resolution.outputScale, 0, 0],
          background: 'rgb(255, 255, 255)',
        });
        renderTaskRef.current = renderTask;
        await Promise.all([renderTask.promise, textWork]);
        if (!isCurrent()) return;

        pageRef.current?.cleanup();
        pageRef.current = page;
        effectiveScaleRef.current = scale;
        setEffectiveScale(scale);
        readyPageRef.current = pageNumber;
        renderedSnapshotRef.current = snapshot;
        setRenderedPage({ snapshot, pageNumber, revision });
        setPreviewState({ status: 'ready', pageNumber });
      } catch (error) {
        if (isCurrent() && !isExpectedCancellation(error)) {
          setPreviewState({
            status: 'error',
            stage: 'rendering',
            message: 'Your generated document and original lyrics are still available. Retry the preview.',
          });
        }
      } finally {
        if (renderRevisionRef.current === revision) {
          renderTaskRef.current = null;
          textLayerWorkRef.current = null;
        }
      }
    };

    const previousWork = renderWorkRef.current;
    const work = previousWork.catch(reportRenderQueueFailure).then(renderPage);
    renderWorkRef.current = work;
    return () => {
      active = false;
      renderRevisionRef.current += 1;
      renderTaskRef.current?.cancel();
      textLayerRef.current?.cancel();
    };
  }, [snapshot, documentRevision, pageNumber, zoomMode, manualScale, viewportSize, renderAttempt]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const isNativeFullscreen = document.fullscreenElement === previewRootRef.current;
      setNativeFullscreen(isNativeFullscreen);
      if (isNativeFullscreen) {
        setFallbackFullscreen(false);
        requestAnimationFrame(() => focusableElements(previewRootRef.current ?? document.body)[0]?.focus());
      } else if (!fallbackFullscreen) {
        requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [fallbackFullscreen]);

  useEffect(() => {
    if (!isExpanded) return;
    const background = Array.from(document.querySelectorAll<HTMLElement>(
      '.masthead, .page-intro, .editor-panel, .workspace-footer',
    ));
    const previousInert = background.map((element) => element.inert);
    const previousOverflow = document.body.style.overflow;
    for (const element of background) element.inert = true;
    document.body.style.overflow = 'hidden';
    const root = previewRootRef.current;
    requestAnimationFrame(() => focusableElements(root ?? document.body)[0]?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFallbackFullscreen(false);
        requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
      } else if (event.key === 'Tab' && root) {
        const controls = focusableElements(root);
        if (controls.length === 0) {
          event.preventDefault();
          root.focus();
          return;
        }
        const first = controls[0]!;
        const last = controls.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      background.forEach((element, index) => { element.inert = previousInert[index]!; });
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isExpanded, fallbackFullscreen]);

  useEffect(() => () => {
    documentRevisionRef.current += 1;
    void enqueueDisposal().catch(reportCleanupFailure);
  }, [enqueueDisposal]);

  const isDocumentLoaded = Boolean(snapshot && loadedSnapshot === snapshot && pageCount > 0);
  const downloadReady = Boolean(
    snapshot
    && !stale
    && generationStatus === 'idle'
    && previewState.status === 'ready'
    && renderedPage?.snapshot === snapshot
    && renderedPage.pageNumber === pageNumber
    && renderedPage.revision > 0,
  );

  function requestPageChange(nextPage: number) {
    if (!isDocumentLoaded || nextPage < 1 || nextPage > pageCount || nextPage === pageNumber) return;
    cancelCurrentRender();
    setPreviewState({ status: 'rendering-page', pageNumber: nextPage });
    setPageNumber(nextPage);
  }

  function requestZoom(direction: ZoomDirection) {
    if (!isDocumentLoaded || !canZoom(effectiveScaleRef.current, direction)) return;
    cancelCurrentRender();
    const nextScale = manualZoomScale(effectiveScaleRef.current, direction);
    effectiveScaleRef.current = nextScale;
    setZoomMode('manual');
    setManualScale(nextScale);
    setPreviewState({ status: 'rendering-page', pageNumber });
  }

  function selectFitMode(mode: FitMode) {
    if (!isDocumentLoaded) return;
    cancelCurrentRender();
    setZoomMode(mode);
    setPreviewState({ status: 'rendering-page', pageNumber });
  }

  function retryPreview() {
    if (documentRef.current && loadedSnapshotRef.current === snapshot) {
      cancelCurrentRender();
      setPreviewState({ status: 'rendering-page', pageNumber });
      setRenderAttempt((attempt) => attempt + 1);
    } else {
      setPreviewState({ status: 'loading-document' });
      setLoadAttempt((attempt) => attempt + 1);
    }
  }

  function handleDownload() {
    const currentRenderedPage = renderedPage;
    const isStillEligible = Boolean(
      snapshot
      && currentSnapshotRef.current === snapshot
      && renderedSnapshotRef.current === snapshot
      && currentRenderedPage?.snapshot === snapshot
      && currentRenderedPage.pageNumber === pageNumber
      && currentRenderedPage.revision === renderRevisionRef.current
      && readyPageRef.current === pageNumber
      && !currentStaleRef.current
      && generationStatusRef.current === 'idle'
      && previewState.status === 'ready',
    );
    if (!snapshot || !isStillEligible) return;
    try {
      downloadPdf(snapshot);
      setDownloadNotice('Download started.');
    } catch {
      setDownloadNotice('The download could not be started. Try again.');
    }
  }

  async function toggleFullscreen() {
    const root = previewRootRef.current;
    if (!root) return;
    if (document.fullscreenElement === root) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        console.error('The browser could not exit fullscreen.', error);
      }
      return;
    }
    if (fallbackFullscreen) {
      setFallbackFullscreen(false);
      requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
      return;
    }
    if (typeof root.requestFullscreen === 'function') {
      try {
        await root.requestFullscreen();
        return;
      } catch {
        setFallbackFullscreen(true);
        return;
      }
    }
    setFallbackFullscreen(true);
  }

  function onRootKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && fallbackFullscreen) {
      event.preventDefault();
      setFallbackFullscreen(false);
      requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
    }
  }

  const statusMessage = previewState.status === 'empty'
    ? generationStatus === 'loading' ? 'Generating your PDF…' : 'No document yet.'
    : previewState.status === 'loading-document'
      ? 'Loading PDF preview…'
      : previewState.status === 'rendering-page'
        ? `Rendering page ${previewState.pageNumber} of ${pageCount}.`
        : previewState.status === 'ready'
          ? stale ? `Preview ready for a previous version. Page ${pageNumber} of ${pageCount}.` : `Preview ready. Page ${pageNumber} of ${pageCount}.`
          : 'PDF preview needs attention.';

  return (
    <div
      ref={previewRootRef}
      className={`pdf-preview-content${fallbackFullscreen ? ' expanded-fallback' : ''}`}
      role={isExpanded ? 'dialog' : undefined}
      aria-modal={isExpanded ? true : undefined}
      aria-label={isExpanded ? 'Expanded PDF preview' : undefined}
      aria-describedby={isExpanded ? 'expanded-preview-help' : undefined}
      tabIndex={isExpanded ? -1 : undefined}
      onKeyDown={onRootKeyDown}
      data-testid="pdf-preview-content"
    >
      <div className="panel-heading preview-heading">
        <div>
          <h2>PDF preview</h2>
          <p>{snapshot ? snapshot.filename : 'A print-ready document, made in your browser'}</p>
        </div>
        {snapshot && <span className={`preview-version${stale ? ' is-stale' : ''}`}>{stale ? 'Previous version' : 'Current version'}</span>}
      </div>

      {stale && snapshot && <p className="stale-message preview-stale-message" role="status"><strong>Your document has changed</strong><span>Update your PDF before downloading.</span></p>}
      {generationStatus === 'loading' && snapshot && <p className="viewer-generation-note" role="status">Generating an updated PDF. Downloads are paused.</p>}
      {generationStatus === 'error' && snapshot && <p className="viewer-generation-note" role="status">The update could not be generated. This previous PDF is still available for preview.</p>}

      <div ref={viewportRef} className="preview-canvas pdf-preview-viewport" aria-busy={previewState.status === 'loading-document' || previewState.status === 'rendering-page'}>
        {previewState.status === 'empty' ? (
          <div className="preview-state empty-state">
            <span className="state-icon" aria-hidden="true"><FileText size={26} strokeWidth={1.5} /></span>
            <h3>{generationStatus === 'loading' ? 'Generating your PDF…' : generationStatus === 'error' ? 'Unable to generate PDF' : 'No document yet'}</h3>
            <p>{generationStatus === 'loading'
              ? 'Preparing fonts and formatting your lyrics. Multilingual documents may take a little longer.'
              : generationStatus === 'error'
                ? `${generationError ?? 'The PDF could not be generated.'} Your original text is still in the editor.`
                : 'Add a title, artist and lyrics, then generate your PDF.'}</p>
          </div>
        ) : previewState.status === 'error' ? (
          <div className="preview-state error-state" role="alert">
            <h3>Unable to display PDF</h3>
            <p>{previewState.message}</p>
            <button className="secondary-button" type="button" onClick={retryPreview}>Retry preview</button>
          </div>
        ) : (
          <div className={`pdf-page-frame${previewState.status === 'ready' ? ' is-ready' : ''}`} aria-label={`PDF page ${pageNumber} of ${pageCount}`} role="group">
            <canvas ref={canvasRef} className="pdf-page-canvas" data-testid="pdf-page-canvas" aria-hidden="true" />
            <div ref={textLayerElementRef} className="textLayer pdf-text-layer" data-testid="pdf-text-layer" role="document" aria-label={`Text of PDF page ${pageNumber}`} />
            {previewState.status === 'rendering-page' && <div className="page-rendering-indicator"><LoaderCircle className="spin-icon" size={20} aria-hidden="true" /><span>Rendering page {pageNumber}…</span></div>}
          </div>
        )}
      </div>

      <div className="preview-toolbar" role="toolbar" aria-label="PDF preview controls">
        <div className="toolbar-group page-navigation" aria-label="Page navigation">
          <button type="button" aria-label="Previous page" onClick={() => requestPageChange(pageNumber - 1)} disabled={!isDocumentLoaded || pageNumber <= 1}>
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <span className="toolbar-readout page-indicator" data-testid="page-indicator" aria-live="polite" aria-atomic="true">{pageCount > 0 ? `${pageNumber} / ${pageCount}` : '— / —'}</span>
          <button type="button" aria-label="Next page" onClick={() => requestPageChange(pageNumber + 1)} disabled={!isDocumentLoaded || pageNumber >= pageCount}>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="toolbar-group zoom-controls" aria-label="Zoom controls">
          <button type="button" aria-label="Zoom out" onClick={() => requestZoom('out')} disabled={!isDocumentLoaded || effectiveScale <= 0 || !canZoom(effectiveScale, 'out')}>
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <span className="toolbar-readout zoom-readout" aria-label={`Zoom ${effectiveScale > 0 ? getZoomPercent(effectiveScale) : 'not available'} percent`}>{effectiveScale > 0 ? `${getZoomPercent(effectiveScale)}%` : '—%'}</span>
          <button type="button" aria-label="Zoom in" onClick={() => requestZoom('in')} disabled={!isDocumentLoaded || effectiveScale <= 0 || !canZoom(effectiveScale, 'in')}>
            <ZoomIn size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="toolbar-group fit-controls" aria-label="Page fit controls">
          <button type="button" aria-label="Fit page" aria-pressed={zoomMode === 'page'} onClick={() => selectFitMode('page')} disabled={!isDocumentLoaded}>Fit page</button>
          <button type="button" aria-label="Fit page to width" aria-pressed={zoomMode === 'width'} onClick={() => selectFitMode('width')} disabled={!isDocumentLoaded}>Fit width</button>
        </div>

        <button
          ref={fullscreenButtonRef}
          className="fullscreen-button"
          type="button"
          aria-label={isExpanded ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={isExpanded}
          aria-haspopup="dialog"
          onClick={() => void toggleFullscreen()}
          disabled={!snapshot}
        >
          {isExpanded ? <Minimize2 size={15} aria-hidden="true" /> : <Expand size={15} aria-hidden="true" />}
          <span>{isExpanded ? 'Exit fullscreen' : 'Fullscreen'}</span>
        </button>

        <button
          className="download-button"
          type="button"
          aria-label="Download PDF"
          onClick={handleDownload}
          disabled={!downloadReady}
        >
          <Download size={15} aria-hidden="true" /><span>Download PDF</span>
        </button>
      </div>

      <p className="toolbar-note" id="expanded-preview-help">{fallbackFullscreen ? 'Expanded preview. Press Escape to return to the editor.' : stale ? 'Update your PDF to enable downloading.' : 'Use the controls to inspect each page before downloading.'}</p>

      {snapshot && (
        <dl className="document-facts preview-document-facts">
          <div><dt>Pages</dt><dd>{pageCount > 0 ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` : `${snapshot.pageCount} ${snapshot.pageCount === 1 ? 'page' : 'pages'}`}</dd></div>
          <div><dt>Paper</dt><dd>{paperLabel(snapshot)}</dd></div>
          <div><dt>Orientation</dt><dd>Portrait</dd></div>
          <div><dt>File size</dt><dd>{formatBytes(snapshot.blob.size)}</dd></div>
        </dl>
      )}

      <p className="sr-only" id="preview-status" role="status" aria-live="polite" aria-atomic="true" aria-label="PDF preview status">
        {statusMessage} {downloadNotice}
      </p>
    </div>
  );
}
