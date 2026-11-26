import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = 'process' in globalThis
  ? import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
  : workerUrl;

export { pdfjs };
