import { expect, test } from '@playwright/test';

test('production workspace renders and generates a real PDF in the browser', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lyrics made simple.' })).toBeVisible();
  await expect(page.getByLabel('Song title')).toBeVisible();
  await page.getByLabel('Song title').fill('Browser workspace');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('The real production form creates this document.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF document status')).toContainText('PDF generated');
  await expect(page.locator('.document-facts')).toContainText(/\d+(\.\d+)?\s+KB|\d+ bytes/);
  expect(runtimeErrors).toEqual([]);
});

test('Lyrie branding, metadata, logo and favicon assets load responsively', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Lyrie — Lyrics to PDF Converter');
  await expect(page.getByRole('heading', { level: 1, name: 'Lyrics made simple.' })).toHaveCount(1);
  await expect(page.locator('.page-intro p')).toHaveText('Turn your favorite lyrics into clean, print-ready PDFs.');
  const brandLink = page.getByRole('link', { name: 'Lyrie home' });
  await expect(brandLink).toHaveAttribute('href', '#main');
  const logo = brandLink.locator('img');
  await expect(logo).toHaveAttribute('src', '/brand/lyrie-logo.svg');
  await expect(logo).toBeVisible();
  await expect(page.locator('.masthead')).not.toContainText('Private by design');
  await expect(page.locator('.workspace-footer')).toContainText('Your lyrics are processed in this browser and are not saved.');
  await expect(page.locator('.wordmark')).not.toContainText('lyrics.to.pdf');
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', 'Lyrie');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Turn your favorite lyrics into clean, print-ready PDFs with Lyrie. Simple, private, and processed entirely in your browser.');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Lyrie — Lyrics made simple.');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', 'Turn your favorite lyrics into clean, print-ready PDFs with Lyrie. Simple, private, and processed entirely in your browser.');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Lyrie');

  for (const [selector, expectedType] of [
    ['link[rel="icon"][type="image/svg+xml"]', 'image/svg+xml'],
    ['link[rel="icon"][type="image/png"]', 'image/png'],
  ] as const) {
    const iconUrl = await page.locator(selector).getAttribute('href');
    expect(iconUrl).toMatch(/^\/brand\/lyrie-icon\.(svg|png)$/);
    const response = await request.get(iconUrl!);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain(expectedType);
  }

  for (const width of [320, 375, 390, 768, 1024, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => {
      const header = document.querySelector('.masthead')!.getBoundingClientRect();
      const logoBounds = document.querySelector('.wordmark img')!.getBoundingClientRect();
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, width: innerWidth, header, logoBounds };
    });
    expect(layout.scrollWidth).toBe(layout.clientWidth);
    expect(layout.header.height).toBe(width < 640 ? 56 : 64);
    expect(layout.logoBounds.height).toBe(width < 640 ? 32 : 36);
    expect(layout.logoBounds.right).toBeLessThan(layout.width);
  }
});

test('desktop workspace stays centered at wide viewports with a single-row toolbar and centered empty state', async ({ page }) => {
  await page.goto('/');
  for (const [width, height] of [[1440, 1064], [1920, 1080], [2560, 1440]] as const) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
      };
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        main: box('.workspace-main'),
        intro: box('.page-intro'),
        editor: box('.editor-panel'),
        preview: box('.preview-panel'),
        toolbar: box('.preview-toolbar'),
        fullscreen: box('.fullscreen-button'),
        canvas: box('.pdf-preview-viewport'),
        emptyState: box('.empty-state'),
        mastheadLogo: box('.wordmark img'),
        background: getComputedStyle(document.querySelector('.app-shell')!).backgroundImage,
      };
    });
    const expectedContentWidth = Math.min(layout.clientWidth - 80, 1280);
    expect(layout.background).toContain('linear-gradient');
    expect(layout.scrollWidth).toBe(layout.clientWidth);
    expect(layout.main.width).toBeLessThanOrEqual(1360);
    expect(Math.abs(layout.intro.x - (layout.clientWidth - expectedContentWidth) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.intro.x - layout.mastheadLogo.x)).toBeLessThanOrEqual(1);
    expect(layout.preview.x).toBeGreaterThan(layout.editor.right);
    expect(Math.abs(layout.canvas.y + layout.canvas.height / 2 - (layout.emptyState.y + layout.emptyState.height / 2))).toBeLessThanOrEqual(1);
    expect(layout.toolbar.height).toBeLessThanOrEqual(64);
    expect(layout.toolbar.right - layout.fullscreen.right).toBeLessThanOrEqual(10);
    await page.screenshot({ path: `docs/superpowers/evidence/lyrie-desktop-${width}.png` });
  }

  await page.setViewportSize({ width: 320, height: 780 });
  const mobile = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(mobile.scrollWidth).toBe(mobile.clientWidth);
  await page.screenshot({ path: 'docs/superpowers/evidence/lyrie-mobile-320.png' });
});

test('mobile preview controls remain separated and the empty state stays centered', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => {
      const toolbar = document.querySelector('.preview-toolbar')!;
      const canvas = document.querySelector('.pdf-preview-viewport')!.getBoundingClientRect();
      const empty = document.querySelector('.empty-state')!.getBoundingClientRect();
      const items = Array.from(toolbar.querySelectorAll('.toolbar-group > *, .fullscreen-button'), (element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      const overlaps: Array<[number, number]> = [];
      for (let first = 0; first < items.length; first += 1) {
        for (let second = first + 1; second < items.length; second += 1) {
          const a = items[first]!;
          const b = items[second]!;
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push([first, second]);
        }
      }
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        overlaps,
        canvasCenterY: canvas.top + canvas.height / 2,
        emptyCenterY: empty.top + empty.height / 2,
      };
    });
    expect(layout.scrollWidth).toBe(layout.clientWidth);
    expect(layout.overlaps).toEqual([]);
    expect(Math.abs(layout.canvasCenterY - layout.emptyCenterY)).toBeLessThanOrEqual(1);
    if (width === 390) await page.screenshot({ path: 'docs/superpowers/evidence/lyrie-mobile-390.png', fullPage: true });
  }
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

test('browser loads multilingual fonts on demand and renders mixed-script continuation pages', async ({ page }) => {
  const fontRequests: string[] = [];
  const origin = new URL('http://127.0.0.1:4173').origin;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/fonts/pdf/')) {
      expect(url.origin).toBe(origin);
      fontRequests.push(url.pathname);
    }
  });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ generatePdf }, { processSongInput }, pdfjs] = await Promise.all([
      import('/src/features/pdf/generate-pdf.ts'),
      import('/src/features/lyrics/validate-input.ts'),
      import('/node_modules/pdfjs-dist/build/pdf.mjs'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
    const latin = processSongInput({
      title: 'A Small Paper Moon',
      artist: 'Synthetic Test',
      rawLyrics: 'Bahay-kubo, cafe\u0301, and a lantern in the morning.',
      paper: { size: 'A4' },
    });
    if (!latin.success) throw new Error('The Latin browser fixture did not validate.');
    const latinSnapshot = await generatePdf(latin.data);
    const latinRequests = performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/fonts/pdf/')).length;
    const title = '日本語の歌と灯り '.repeat(7).trim();
    const artist = '한국어의 가수 '.repeat(6).trim();
    const lyrics = [
      'Bahay-kubo at café\u0301; 한국어의 노래; 日本語かなカナ漢字; 简体中文; 繁體中文.',
      ...Array.from({ length: 140 }, (_, index) => 'Browser flow marker ' + String(index + 1).padStart(3, '0')),
      '',
      '[Chorus]',
      'Together under the quiet morning light.',
    ].join('\n');
    const mixed = processSongInput({ title, artist, rawLyrics: lyrics, paper: { size: 'A4' } });
    if (!mixed.success) throw new Error('The multilingual browser fixture did not validate.');
    const started = performance.now();
    const snapshot = await generatePdf(mixed.data);
    const firstGenerationMs = performance.now() - started;
    const repeatStarted = performance.now();
    const repeated = await generatePdf(mixed.data);
    const repeatedGenerationMs = performance.now() - repeatStarted;
    const loadingTask = pdfjs.getDocument({ data: snapshot.bytes.slice() });
    try {
      const document = await loadingTask.promise;
      const pageTexts = [];
      const fontNames = new Set<string>();
      let darkPixels = 0;
      for (let number = 1; number <= document.numPages; number += 1) {
        const pdfPage = await document.getPage(number);
        const content = await pdfPage.getTextContent({ disableNormalization: true });
        const items = content.items.filter((item) => 'str' in item);
        for (const item of items) fontNames.add(item.fontName);
        pageTexts.push(items.map((item) => item.str).join(''));
        if (number === 1) {
          const viewport = pdfPage.getViewport({ scale: 1 });
          const canvas = globalThis.document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas rendering is unavailable.');
          await pdfPage.render({ canvasContext: context, viewport }).promise;
          globalThis.document.body.append(canvas);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index]! < 80 && pixels[index + 1]! < 80 && pixels[index + 2]! < 80) darkPixels += 1;
          }
        }
      }
      const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      return {
        latinBytes: latinSnapshot.bytes.byteLength,
        latinFontRequestCount: latinRequests,
        bytes: snapshot.bytes.byteLength,
        repeatedBytes: repeated.bytes.byteLength,
        pageCount: document.numPages,
        pageTexts,
        fontCount: fontNames.size,
        darkPixels,
        firstGenerationMs,
        repeatedGenerationMs,
        usedHeapBytes: heap?.usedJSHeapSize,
      };
    } finally {
      await loadingTask.destroy();
    }
  });

  expect(result.latinFontRequestCount).toBe(0);
  expect(fontRequests.map((path) => path.split('/').at(-1)).sort()).toEqual([
    'NotoSansJP-Bold.otf', 'NotoSansJP-Regular.otf',
    'NotoSansKR-Bold.otf', 'NotoSansKR-Regular.otf',
    'NotoSansSC-Bold.otf', 'NotoSansSC-Regular.otf',
    'NotoSansTC-Bold.otf', 'NotoSansTC-Regular.otf',
  ]);
  expect(result.pageCount).toBeGreaterThan(1);
  expect(result.pageTexts.every((text) => text.includes('日本語の歌と灯り') && text.includes('한국어의 가수'))).toBe(true);
  const allText = result.pageTexts.join('');
  for (const phrase of ['Bahay-kubo', '한국어의 노래', '日本語かなカナ漢字', '简体中文', '繁體中文', 'Browser flow marker 140', '[Chorus]']) {
    expect(allText).toContain(phrase);
  }
  expect(allText).not.toContain('\uFFFD');
  expect(allText).not.toContain('\u0000');
  expect(result.fontCount).toBeGreaterThan(1);
  expect(result.darkPixels).toBeGreaterThan(1000);
  expect(result.bytes).toBe(result.repeatedBytes);
  console.log(`Multilingual PDF: ${result.pageCount} pages, ${result.bytes} bytes; generation ${result.firstGenerationMs.toFixed(0)} ms cold / ${result.repeatedGenerationMs.toFixed(0)} ms warm; browser heap ${result.usedHeapBytes ?? 'unavailable'} bytes.`);
  await page.locator('canvas').screenshot({ path: 'test-results/phase4-multilingual-first-page.png' });
});
