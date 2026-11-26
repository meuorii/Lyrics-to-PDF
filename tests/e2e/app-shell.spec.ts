import { expect, test } from '@playwright/test';

test('application shell renders and generates a real PDF in the browser', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lyrics to PDF' })).toBeVisible();
  await expect(page.getByText('Core PDF engine')).toBeVisible();
  await page.getByRole('button', { name: 'Generate PDF fixture' }).click();
  await expect(page.getByRole('status')).toContainText('Generated PDF');
  await expect(page.getByRole('status')).toContainText(/\d+ bytes/);
  expect(runtimeErrors).toEqual([]);
});

test('repeated title and artist are visibly rendered on every continuation page', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ generatePdf }, { processSongInput }, pdfjs] = await Promise.all([
      import('/src/features/pdf/generate-pdf.ts'),
      import('/src/features/lyrics/validate-input.ts'),
      import('/node_modules/pdfjs-dist/build/pdf.mjs'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
    const processed = processSongInput({
      title: 'Paper Lanterns',
      artist: 'The Quiet Signals',
      rawLyrics: Array.from({ length: 240 }, (_, index) => `Flow marker ${String(index + 1).padStart(3, '0')}`).join('\n'),
      paper: { size: 'A4' },
    });
    if (!processed.success) throw new Error('Browser fixture validation failed.');
    const snapshot = await generatePdf(processed.data);
    const { bytes } = snapshot;
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

test('browser production generation uses resolved A3, A6, Long Bond and custom paper', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const [{ generatePdf }, { processSongInput }] = await Promise.all([
      import('/src/features/pdf/generate-pdf.ts'),
      import('/src/features/lyrics/validate-input.ts'),
    ]);
    const selections = [
      { size: 'A3' },
      { size: 'A6' },
      { size: 'Long Bond' },
      { size: 'Custom', custom: { width: 8.5, height: 11, unit: 'in' } },
    ] as const;
    const snapshots = [];
    for (const paper of selections) {
      const processed = processSongInput({
        title: 'Paper Lanterns',
        artist: 'The Quiet Signals',
        rawLyrics: '[Verse 1: Performer A]\nThe browser builds this custom paper document.',
        paper,
      });
      if (!processed.success) throw new Error('The browser paper fixture did not validate.');
      const snapshot = await generatePdf(processed.data);
      snapshots.push({ size: snapshot.paper.size, pageCount: snapshot.pageCount, byteLength: snapshot.bytes.byteLength });
    }
    return snapshots;
  });

  expect(results.map((result) => result.size)).toEqual(['A3', 'A6', 'Long Bond', 'Custom']);
  expect(results.every((result) => result.pageCount === 1 && result.byteLength > 1000)).toBe(true);
});
