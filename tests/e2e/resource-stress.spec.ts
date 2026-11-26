import { expect, test } from '@playwright/test';

test('large lyric input keeps all continuation content previewable', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Song title').fill('Large input stress run');
  await page.getByLabel('Artist').fill('Release QA');
  const lyrics = Array.from({ length: 1_000 }, (_, index) =>
    `STRESS-${String(index + 1).padStart(4, '0')}: A synthetic line checks long-document flow and continuation without changing any source text.`,
  ).join('\n');
  await page.getByRole('textbox', { name: 'Lyrics' }).fill(lyrics);

  const start = Date.now();
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready', { timeout: 60_000 });
  const generationMs = Date.now() - start;
  const firstPageText = await page.getByTestId('pdf-text-layer').innerText();
  expect(firstPageText).toContain('STRESS-0001');

  const indicator = await page.getByTestId('page-indicator').innerText();
  const pageCount = Number(indicator.split('/')[1]?.trim());
  expect(pageCount).toBeGreaterThan(1);
  for (let pageNumber = 2; pageNumber < pageCount; pageNumber += 1) {
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByTestId('page-indicator')).toHaveText(`${pageNumber} / ${pageCount}`);
    await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  }
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByTestId('page-indicator')).toHaveText(`${pageCount} / ${pageCount}`);
  await expect(page.getByLabel('PDF preview status')).toContainText('Preview ready');
  const lastPageText = await page.getByTestId('pdf-text-layer').innerText();
  expect(lastPageText).toContain('STRESS-1000');

  const usedHeapBytes = await page.evaluate(() =>
    (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
  );
  console.log(`Large input: 1000 lyric lines, ${pageCount} pages, ${generationMs} ms generation and preview, ${usedHeapBytes ?? 'unavailable'} browser heap bytes.`);
});
