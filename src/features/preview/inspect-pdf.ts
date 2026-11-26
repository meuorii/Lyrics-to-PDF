import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = 'process' in globalThis
  ? import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
  : workerUrl;

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const document = await loadingTask.promise;
    return document.numPages;
  } finally {
    await loadingTask.destroy();
  }
}
