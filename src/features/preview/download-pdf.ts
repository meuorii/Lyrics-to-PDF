import type { PdfSnapshot } from '../../types/domain';

type DownloadablePdf = Pick<PdfSnapshot, 'blob' | 'filename'>;

export function downloadPdf(snapshot: DownloadablePdf): void {
  const objectUrl = URL.createObjectURL(snapshot.blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = snapshot.filename;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  }
}
