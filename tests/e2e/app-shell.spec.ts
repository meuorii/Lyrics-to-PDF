import { expect, test } from '@playwright/test';

test('application shell renders and generates a real PDF in the browser', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lyrics to PDF' })).toBeVisible();
  await expect(page.getByText('Technical foundation')).toBeVisible();
  await page.getByRole('button', { name: 'Generate PDF fixture' }).click();
  await expect(page.getByRole('status')).toContainText('Generated PDF');
  await expect(page.getByRole('status')).toContainText(/\d+ bytes/);
  expect(runtimeErrors).toEqual([]);
});

test('repeated title and artist are visibly rendered on every continuation page', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ generatePdf }, { PDF_LAYOUT }, pdfjs] = await Promise.all([
      import('/src/features/pdf/generate-pdf.ts'),
      import('/src/features/pdf/layout-config.ts'),
      import('/node_modules/pdfjs-dist/build/pdf.mjs'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
    const { bytes } = await generatePdf({
      song: { title: 'Paper Lanterns', artist: 'The Quiet Signals' },
      lyrics: { rawText: Array.from({ length: 240 }, (_, index) => `Flow marker ${String(index + 1).padStart(3, '0')}`).join('\n') },
      layout: PDF_LAYOUT,
    });
    const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
    try {
      const document = await loadingTask.promise;
      const headerInk = [];
      for (let number = 1; number <= document.numPages; number += 1) {
        const pdfPage = await document.getPage(number);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const pixels = canvas.getContext('2d')!.getImageData(20, 20, 250, 70).data;
        let darkPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index]! < 80 && pixels[index + 1]! < 80 && pixels[index + 2]! < 80) darkPixels += 1;
        }
        headerInk.push(darkPixels);
      }
      return { pageCount: document.numPages, headerInk };
    } finally {
      await loadingTask.destroy();
    }
  });

  expect(result.pageCount).toBeGreaterThan(1);
  expect(result.headerInk).toHaveLength(result.pageCount);
  expect(result.headerInk.every((count) => count > 10)).toBe(true);
});
