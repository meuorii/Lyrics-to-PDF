import { expect, test } from '@playwright/test';

test('workspace labels required fields and reports validation without losing input', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Lyrics made simple.' })).toBeVisible();
  await expect(page.getByLabel('Song title')).toBeVisible();
  await expect(page.getByLabel('Artist')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Lyrics' })).toBeVisible();
  await expect(page.getByLabel('Paper size')).toHaveValue('A4');
  await expect(page.getByLabel('Paper size').locator('option')).toHaveText([
    'A3', 'A4', 'A5', 'A6', 'B4', 'B5', 'Letter / Short', 'Long Bond', 'Legal', 'Custom dimensions',
  ]);
  await expect(page.getByRole('heading', { name: 'No document yet' })).toBeVisible();

  await page.getByRole('button', { name: 'Generate PDF' }).click();

  await expect(page.getByRole('alert')).toContainText('Enter a song title.');
  await expect(page.getByLabel('Song title')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Artist')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('textbox', { name: 'Lyrics' })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Song title')).toBeFocused();
  await page.screenshot({ path: 'test-results/phase5-validation.png', fullPage: true });
  await expect(page.getByRole('heading', { name: 'No document yet' })).toBeVisible();
  let resetPrompted = false;
  page.on('dialog', (dialog) => { resetPrompted = true; void dialog.dismiss(); });
  await page.getByRole('button', { name: 'Reset form' }).click();
  expect(resetPrompted).toBe(false);
});

test('custom paper controls convert units and generate the unchanged physical dimensions', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Paper size').selectOption('Custom');
  await expect(page.getByRole('spinbutton', { name: 'Width' })).toHaveValue('210');
  await expect(page.getByRole('spinbutton', { name: 'Height' })).toHaveValue('297');
  await page.getByLabel('Song title').fill('Unit switch');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('A lyric with unchanged paper dimensions.');
  await page.getByLabel('Unit').selectOption('in');
  await expect(page.getByRole('spinbutton', { name: 'Width' })).toHaveValue('8.2677');
  await expect(page.getByRole('spinbutton', { name: 'Height' })).toHaveValue('11.6929');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.locator('.document-facts')).toContainText('210 × 297 mm');
  await page.getByLabel('Unit').selectOption('mm');
  await expect(page.getByRole('spinbutton', { name: 'Width' })).toHaveValue('210');
  await expect(page.getByRole('spinbutton', { name: 'Height' })).toHaveValue('297');
  await expect(page.getByText('Your document has changed')).toBeHidden();
});

test('valid input creates a real snapshot, marks edits stale, regenerates, and resets safely', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/');

  await page.getByLabel('Song title').fill('Paper Lanterns');
  await page.getByLabel('Artist').fill('The Quiet Signals');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('[Verse 1]\nLight along the window frame.');
  await expect(page.getByText('39 characters')).toBeVisible();
  await page.getByRole('button', { name: 'Generate PDF' }).click();

  await expect(page.getByLabel('PDF document status')).toContainText('PDF generated');
  await expect(page.getByLabel('PDF document status')).toContainText('1 page');
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  await expect(page.getByTestId('pdf-text-layer')).toContainText('Light along the window frame.');
  await page.screenshot({ path: 'test-results/phase5-generated.png', fullPage: true });

  await page.getByLabel('Song title').fill('Paper Lanterns, revised');
  await expect(page.getByText('Your document has changed')).toBeVisible();
  await expect(page.getByText('Update your PDF before downloading.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/phase5-stale.png', fullPage: true });
  await page.getByRole('button', { name: 'Update PDF' }).click();
  await expect(page.getByLabel('PDF document status')).toContainText('PDF generated');
  await expect(page.getByText('Your document has changed')).toBeHidden();

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reset form' }).click();
  await expect(page.getByLabel('Song title')).toHaveValue('');
  await expect(page.getByLabel('Artist')).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Lyrics' })).toHaveValue('');
  await expect(page.getByLabel('Paper size')).toHaveValue('A4');
  await expect(page.getByRole('heading', { name: 'No document yet' })).toBeVisible();
  await expect(page.getByLabel('Song title')).toBeFocused();
  expect(runtimeErrors).toEqual([]);
});

test('generation toast stays on one request and success follows PDF.js readiness', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Toast lifecycle');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('A toast must wait for the preview to finish rendering.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();

  const loading = page.getByRole('status', { name: /Generating PDF\. Preparing your printable document\./ });
  await expect(loading).toBeVisible();
  const toastId = await loading.getAttribute('data-toast-id');
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  const success = page.getByRole('status', { name: /PDF generated\. Your document is ready to download\./ });
  await expect(success).toBeVisible();
  await expect(success).toHaveAttribute('data-toast-id', toastId!);
});

test('stale warning appears once and a meaningful reset reports completion', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Stale toast');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('Keep this previous document until it can be updated.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');

  await page.getByLabel('Song title').fill('Stale toast, revised');
  await page.getByLabel('Artist').fill('Workspace test, revised');
  const warning = page.getByRole('status', { name: /Document needs updating\. Update your PDF to apply your changes\./ });
  await expect(warning).toBeVisible();
  await expect(page.getByTestId('pdf-text-layer')).toContainText('Keep this previous document');
  await expect(page.locator('[data-toast-id]').filter({ hasText: 'Document needs updating' })).toHaveCount(1);
});

test('reset toast follows an accepted reset and a cancelled reset keeps the draft', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Keep my draft');
  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('button', { name: 'Reset form' }).click();
  await expect(page.getByLabel('Song title')).toHaveValue('Keep my draft');
  await expect(page.getByRole('status', { name: /Editor reset/ })).toHaveCount(0);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Reset form' }).click();
  await expect(page.getByLabel('Song title')).toHaveValue('');
  await expect(page.getByRole('status', { name: /Editor reset\. Your workspace has been cleared\./ })).toBeVisible();
});

test('repeated generation and reset cycles clear the previous preview cleanly', async ({ page }) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await page.getByLabel('Song title').fill(`Lifecycle cycle ${cycle}`);
    await page.getByLabel('Artist').fill('Synthetic release check');
    await page.getByRole('textbox', { name: 'Lyrics' }).fill(`Cycle marker ${cycle}`);
    await page.getByRole('button', { name: 'Generate PDF' }).click();
    await expect(page.getByLabel('PDF document status')).toContainText('PDF generated');
    await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
    await page.getByRole('button', { name: 'Reset form' }).click();
    await expect(page.getByRole('heading', { name: 'No document yet' })).toBeVisible();
    await expect(page.locator('.pdf-page-canvas')).toHaveCount(0);
    await expect(page.getByLabel('PDF document status')).toContainText('No PDF has been generated');
  }
});

test('production editor canonicalizes an annotated Rap heading in the Long Bond preview', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Synthetic Rap Regression');
  await page.getByLabel('Artist').fill('Synthetic Test Artist');
  await page.getByLabel('Paper size').selectOption('Long Bond');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill([
    '[Rap Verse 2: Performer A, Performer B, Performer C & Performer D]',
    'Unique synthetic rap lyric marker.',
    '[Spoken-Word (Reference: Subtitle): Performer E]',
    'Unique synthetic spoken lyric marker.',
  ].join('\n'));
  await page.getByRole('button', { name: 'Generate PDF' }).click();

  await expect(page.getByLabel('PDF document status')).toContainText('PDF generated');
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  await expect(page.getByTestId('pdf-text-layer')).toContainText('[Rap Verse 2]');
  await expect(page.getByTestId('pdf-text-layer')).toContainText('[Spoken Word]');
  await expect(page.getByTestId('pdf-text-layer')).toContainText('Unique synthetic rap lyric marker.');
  await expect(page.getByTestId('pdf-text-layer')).toContainText('Unique synthetic spoken lyric marker.');
  await expect(page.getByTestId('pdf-text-layer')).not.toContainText('Performer A');
  await expect(page.getByTestId('pdf-text-layer')).not.toContainText('Reference: Subtitle');
  await expect(page.getByTestId('pdf-text-layer')).toContainText('Synthetic Test Artist');
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
});

test('workspace stacks at small widths, splits at desktop, and never overflows horizontally', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => {
      const editor = document.querySelector('[data-testid="editor-panel"]')!.getBoundingClientRect();
      const preview = document.querySelector('[data-testid="preview-panel"]')!.getBoundingClientRect();
      return {
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        editorTop: editor.top,
        previewTop: preview.top,
      };
    });
    expect(layout.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(layout.viewportWidth);
    if (width >= 1024) expect(Math.abs(layout.editorTop - layout.previewTop)).toBeLessThan(2);
    else expect(layout.previewTop).toBeGreaterThan(layout.editorTop);
    await page.screenshot({ path: `test-results/phase5-workspace-${width}.png` });
  }
});

test('custom paper dimensions reach generation with their selected unit', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Custom page');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('A lyric on custom paper.');
  await page.getByLabel('Paper size').selectOption('Custom');
  await page.getByLabel('Unit').selectOption('in');
  await page.getByRole('spinbutton', { name: 'Width' }).fill('8.5');
  await page.getByRole('spinbutton', { name: 'Height' }).fill('11');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF document status')).toContainText('PDF generated');
  await expect(page.locator('.document-facts')).toContainText('215.9 × 279.4 mm');
});

test('generation errors keep input and can be retried after correction', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Lantern song');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('Unsupported 🛠 character.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();

  await expect(page.getByText('Unable to generate PDF')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Lyrics' })).toHaveValue('Unsupported 🛠 character.');
  await page.screenshot({ path: 'test-results/phase5-error.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('Supported text after correction.');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('PDF document status')).toContainText('PDF generated');
});

test('invalid custom paper is reported before generation and focuses the dimension', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Small page');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('Keep this text.');
  await page.getByLabel('Paper size').selectOption('Custom');
  await page.getByRole('spinbutton', { name: 'Width' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Height' }).fill('10');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('Paper width is too small');
  await expect(page.getByRole('spinbutton', { name: 'Width' })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Lyrics' })).toHaveValue('Keep this text.');
  await expect(page.getByRole('heading', { name: 'No document yet' })).toBeVisible();
});

test('empty custom dimensions stay empty across unit changes and explain the missing value', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Missing dimension');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('Keep this text.');
  await page.getByLabel('Paper size').selectOption('Custom');
  await page.getByRole('spinbutton', { name: 'Width' }).fill('');
  await expect(page.getByRole('spinbutton', { name: 'Width' })).toHaveValue('');
  await page.getByLabel('Unit').selectOption('in');
  await expect(page.getByRole('spinbutton', { name: 'Width' })).toHaveValue('');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a custom paper width.');
  await expect(page.getByRole('spinbutton', { name: 'Width' })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Lyrics' })).toHaveValue('Keep this text.');
});

test('reset invalidates a PDF generation already in progress', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByLabel('Song title').fill('Interrupted song');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('This request will be reset.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByRole('button', { name: 'Generating your PDF…' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/phase5-loading.png', fullPage: true });
  await page.getByRole('button', { name: 'Reset form' }).click();
  await expect(page.getByLabel('Song title')).toHaveValue('');
  await page.waitForTimeout(1200);
  await expect(page.getByLabel('PDF document status')).toContainText('No PDF has been generated');
  await expect(page.getByRole('heading', { name: 'No document yet' })).toBeVisible();
});

test('keyboard controls remain named and primary control contrast is readable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Song title')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();

  const ratios = await page.evaluate(() => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/gu)?.slice(0, 3).map(Number) ?? [];
      const linear = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
    };
    const ratio = (a: string, b: string) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0]! + 0.05) / (values[1]! + 0.05);
    };
    const primary = document.querySelector('.primary-button')!;
    const input = document.querySelector('#song-title')!;
    return {
      primaryText: ratio(getComputedStyle(primary).color, getComputedStyle(primary).backgroundColor),
      inputBoundary: ratio(getComputedStyle(input).borderTopColor, getComputedStyle(input).backgroundColor),
    };
  });
  expect(ratios.primaryText).toBeGreaterThanOrEqual(4.5);
  expect(ratios.inputBoundary).toBeGreaterThanOrEqual(3);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const animationDuration = await page.evaluate(() => {
    const spinner = document.createElement('span');
    spinner.className = 'spin-icon';
    document.body.append(spinner);
    const duration = getComputedStyle(spinner).animationDuration;
    spinner.remove();
    return Number.parseFloat(duration);
  });
  expect(animationDuration).toBeLessThan(0.001);
});

test('PDF generation and inspection modules stay unloaded until a valid request', async ({ page }) => {
  await page.goto('/');
  const initialPdfResources = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((url) => /generate-pdf|inspect-pdf|pdfmake|pdfjs-dist|fonts\/pdf/iu.test(url)));
  expect(initialPdfResources).toEqual([]);

  await page.getByLabel('Song title').fill('Lazy document');
  await page.getByLabel('Artist').fill('Workspace test');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill('Generate only after the user asks.');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF document status')).toContainText('PDF generated');
  const loadedPdfResources = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((url) => /generate-pdf|inspect-pdf|pdfmake|pdfjs-dist/iu.test(url)));
  expect(loadedPdfResources.length).toBeGreaterThan(0);
});
