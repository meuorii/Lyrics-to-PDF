import { useState } from 'react';
import { FileText } from 'lucide-react';
import { PDF_LAYOUT } from './features/pdf/layout-config';
import type { PdfPreviewState } from './types/domain';

const FEASIBILITY_FIXTURE = {
  song: { title: 'Paper Lanterns', artist: 'The Quiet Signals' },
  lyrics: {
    rawText: '[Verse 1]\nLight along the window frame\nThe evening calls us by our names\n\n[Chorus]\nWe carry paper lanterns home',
  },
  layout: PDF_LAYOUT,
};

export default function App() {
  const [preview, setPreview] = useState<PdfPreviewState>({ status: 'empty' });

  async function generateFixture() {
    setPreview({ status: 'loading' });
    try {
      const [{ generatePdf }, { getPdfPageCount }] = await Promise.all([
        import('./features/pdf/generate-pdf'),
        import('./features/preview/inspect-pdf'),
      ]);
      const { bytes } = await generatePdf(FEASIBILITY_FIXTURE);
      const pageCount = await getPdfPageCount(bytes);
      setPreview({ status: 'ready', pageCount, byteLength: bytes.byteLength });
    } catch {
      setPreview({ status: 'error', message: 'The local PDF feasibility check failed.' });
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-brand-yellow">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <span className="flex size-9 items-center justify-center rounded-sm bg-brand-blue text-white" aria-hidden="true">
            <FileText size={19} strokeWidth={1.8} />
          </span>
          <p className="text-sm font-bold tracking-tight">lyrics.to.pdf</p>
          <span className="ml-auto text-xs font-semibold uppercase tracking-[0.14em] text-muted">Document tool</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="max-w-2xl border-l-2 border-brand-blue pl-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-brand-blue">Technical foundation</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Lyrics to PDF</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            A local browser foundation for creating clean, printable song documents.
          </p>
        </section>

        <section className="mt-12 max-w-2xl rounded border border-line bg-white p-6" aria-labelledby="feasibility-title">
          <h2 id="feasibility-title" className="text-base font-semibold">PDF generation check</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Generate a synthetic sample locally and inspect its actual PDF bytes with PDF.js.</p>
          <button
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-sm bg-brand-blue px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand-blue disabled:cursor-wait disabled:opacity-70"
            type="button"
            onClick={generateFixture}
            disabled={preview.status === 'loading'}
          >
            {preview.status === 'loading' ? 'Generating…' : 'Generate PDF fixture'}
          </button>
          <p className="mt-4 min-h-5 text-sm text-muted" role="status" aria-live="polite">
            {preview.status === 'ready' && `Generated PDF · ${preview.pageCount} page · ${preview.byteLength} bytes · browser-only`}
            {preview.status === 'error' && preview.message}
          </p>
        </section>
      </main>
    </div>
  );
}
