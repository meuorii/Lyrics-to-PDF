import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('generates, previews, navigates, and downloads identical multilingual PDF bytes', async ({ page, baseURL, browser, browserName }) => {
  const externalRequests: string[] = [];
  const runtimeErrors: string[] = [];
  const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) externalRequests.push(request.url());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.addInitScript(() => {
    const instrumentedWindow = window as Window & { __phase7PdfTransfers?: number[][] };
    instrumentedWindow.__phase7PdfTransfers = [];
    for (const prototype of [Worker.prototype, MessagePort.prototype]) {
      const originalPostMessage = prototype.postMessage;
      prototype.postMessage = function (message: unknown, transfer?: Transferable[]) {
        for (const item of transfer ?? []) {
          if (!(item instanceof ArrayBuffer) || item.byteLength < 6) continue;
          const bytes = new Uint8Array(item);
          if (bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45) {
            instrumentedWindow.__phase7PdfTransfers!.push(Array.from(bytes));
          }
        }
        return originalPostMessage.call(this, message, transfer);
      };
    }
  });

  await page.goto('/');
  await page.getByLabel('Song title').fill('日本語の灯り');
  await page.getByLabel('Artist').fill('한국어의 노래');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill([
    '[Verse 1: Singer One]',
    'Bahay-kubo at café; 日本語かなカナ漢字; 한국어의 노래; 简体中文; 繁體中文.',
    ...Array.from({ length: 90 }, (_, index) => `Browser page marker ${String(index + 1).padStart(3, '0')}: the garden light carries every note across the morning.`),
  ].join('\n'));
  const generationStartedAt = Date.now();
  await page.getByRole('button', { name: 'Generate PDF' }).click();

  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  const generationAndPreviewMs = Date.now() - generationStartedAt;
  await expect(page.getByTestId('pdf-text-layer')).toContainText('日本語かなカナ漢字');
  await expect(page.getByTestId('pdf-text-layer')).toContainText('한국어의 노래');
  await expect(page.getByTestId('page-indicator')).not.toHaveText('1 / 1');

  const inkPixels = await page.getByTestId('pdf-page-canvas').evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext('2d');
    if (!context) return 0;
    const { data } = context.getImageData(0, 0, element.width, element.height);
    let darkPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index]! < 100 && data[index + 1]! < 100 && data[index + 2]! < 100) darkPixels += 1;
    }
    return darkPixels;
  });
  expect(inkPixels).toBeGreaterThan(100);

  const pageCount = Number((await page.getByTestId('page-indicator').textContent())?.split('/')[1]?.trim());
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText(`2 / ${pageCount}`);
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText(`1 / ${pageCount}`);

  const initialZoom = Number((await page.locator('.zoom-readout').textContent())?.replace('%', ''));
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => page.locator('.zoom-readout').textContent()).not.toBe(`${initialZoom}%`);
  await page.getByRole('button', { name: 'Fit page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fit page', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Fit page to width' }).click();
  await expect(page.getByRole('button', { name: 'Fit page to width' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();

  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null
    || document.querySelector('[role="dialog"][aria-label="Expanded PDF preview"]') !== null)).toBe(true);
  const exitFullscreen = page.getByRole('button', { name: 'Exit fullscreen' });
  if (await page.getByRole('dialog', { name: 'Expanded PDF preview' }).count()) {
    const controls = page.getByRole('dialog', { name: 'Expanded PDF preview' }).locator('button:not([disabled])');
    await expect(controls.first()).toBeFocused();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.keyboard.press('Shift+Tab');
    await expect(controls.last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(controls.first()).toBeFocused();
  }
  await exitFullscreen.click();
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeFocused();

  const transferredBytes = await page.evaluate(() => (window as Window & { __phase7PdfTransfers?: number[][] }).__phase7PdfTransfers ?? []);
  expect(transferredBytes.length).toBeGreaterThanOrEqual(2);
  const sourceBytes = Buffer.from(transferredBytes.at(-1)!);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('한국어의 노래 - 日本語の灯り.pdf');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath!)).toEqual(sourceBytes);

  await page.getByLabel('Song title').fill('Changed title');
  await expect(page.getByText('Your document has changed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
  console.log(`${browserName} ${browser.version()}: generated, previewed and byte-verified a ${sourceBytes.byteLength}-byte multilingual PDF in ${generationAndPreviewMs.toFixed(0)} ms.`);
});

test('CSS fullscreen fallback wraps focus and returns focus with Escape', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await page.getByLabel('Song title').fill('Fallback keyboard review');
  await page.getByLabel('Artist').fill('Synthetic browser test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('A short synthetic page checks keyboard containment.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Expanded PDF preview' });
  await expect(dialog).toBeVisible();
  const controls = dialog.locator('button:not([disabled])');
  await expect(controls.first()).toBeFocused();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeFocused();
});
