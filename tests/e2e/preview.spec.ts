import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('renders the retained PDF snapshot and downloads those exact bytes', async ({ page }) => {
  await page.addInitScript(() => {
    const instrumentedWindow = window as Window & { __phase6PdfTransfers?: number[][] };
    instrumentedWindow.__phase6PdfTransfers = [];
    for (const prototype of [Worker.prototype, MessagePort.prototype]) {
      const originalPostMessage = prototype.postMessage;
      prototype.postMessage = function (message: unknown, transfer?: Transferable[]) {
        for (const item of transfer ?? []) {
          if (!(item instanceof ArrayBuffer) || item.byteLength < 6) continue;
          const bytes = new Uint8Array(item);
          if (bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45) {
            instrumentedWindow.__phase6PdfTransfers!.push(Array.from(bytes));
          }
        }
        return originalPostMessage.call(this, message, transfer);
      };
    }
  });

  await page.goto('/');
  await page.getByLabel('Song title').fill('Window Light');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('The garden light catches every note.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();

  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await expect(page.getByTestId('pdf-text-layer')).toContainText('The garden light catches every note.');
  await expect(page.getByTestId('page-indicator')).toHaveText('1 / 1');
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/phase6-preview-ready.png', fullPage: true });

  const inkPixels = await page.getByTestId('pdf-page-canvas').evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext('2d');
    if (!context) return 0;
    const { data } = context.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height);
    let darkPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index]! < 100 && data[index + 1]! < 100 && data[index + 2]! < 100) darkPixels += 1;
    }
    return darkPixels;
  });
  expect(inkPixels).toBeGreaterThan(100);

  const transferredPdfBytes = await page.evaluate(() => (window as Window & { __phase6PdfTransfers?: number[][] }).__phase6PdfTransfers ?? []);
  expect(transferredPdfBytes.length).toBeGreaterThanOrEqual(2);
  const previewSourceBytes = transferredPdfBytes.at(-1)!;
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Workspace test - Window Light.pdf');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath!)).toEqual(Buffer.from(previewSourceBytes));
});

test('navigates real multipage content, zooms, and restores fit modes', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Pages of Light');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill(Array.from({ length: 90 }, (_, index) => `Page marker ${index + 1}: a long enough line to flow through the columns.`).join('\n'));
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await expect(page.getByTestId('page-indicator')).not.toHaveText('1 / 1');
  await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();

  const pageCount = Number((await page.getByTestId('page-indicator').textContent())?.split('/')[1]?.trim());
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText(`2 / ${pageCount}`);
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  await expect(page.getByTestId('pdf-text-layer')).toContainText('Page marker');

  const initialZoom = Number((await page.locator('.zoom-readout').textContent())?.replace('%', ''));
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(async () => Number((await page.locator('.zoom-readout').textContent())?.replace('%', ''))).toBeGreaterThan(initialZoom);
  await page.getByRole('button', { name: 'Fit page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fit page', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Fit page to width' }).click();
  await expect(page.getByRole('button', { name: 'Fit page to width' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText(`1 / ${pageCount}`);
  await page.setViewportSize({ width: 320, height: 900 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: 'test-results/phase6-preview-mobile.png', fullPage: true });
});

test('CSS fullscreen fallback traps focus and exits with Escape', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await page.getByLabel('Song title').fill('Fullscreen fallback');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('A page in expanded view.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');

  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(page.getByRole('dialog', { name: 'Expanded PDF preview' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Expanded PDF preview' })).toContainText('Expanded preview. Press Escape to return to the editor.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Expanded PDF preview' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeFocused();
});

test('recovers when an initial page canvas cannot be created', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    let rejectFirstPreviewCanvas = true;
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      if (this.classList.contains('pdf-page-canvas') && rejectFirstPreviewCanvas) {
        rejectFirstPreviewCanvas = false;
        return null;
      }
      return originalGetContext.call(this, contextId, ...args as []);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await page.getByLabel('Song title').fill('Preview recovery');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('The original PDF is still available.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByRole('heading', { name: 'Unable to display PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry preview' }).click();
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
});

test('uses native fullscreen and restores focus when it exits', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Native fullscreen');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('A page in native expanded view.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeFocused();
});
