import { expect, test } from '@playwright/test';
import path from 'node:path';

test('真实 OCR 识别单字昵称和金额，并可复用 worker 批量识别', async ({ page }) => {
  const fixture = path.resolve('tests/fixtures/scoreboard-single-character-name.jpg');
  await page.goto('/upload');
  await page.locator('input[type=file]').setInputFiles([fixture, fixture]);
  await page.getByRole('button', { name: '开始识别（2）' }).click();
  await expect(page.locator('.up-item-ready')).toHaveCount(2, { timeout: 100_000 });
  for (const item of await page.locator('.up-item-ready').all()) {
    await expect(item.locator('.up-item-id')).toHaveValue('云');
    await expect(item.locator('.up-item-value')).toHaveAttribute('aria-label', '带出价值：17,824,436');
  }
  await expect(page.getByRole('button', { name: '确认提交（2）' })).toBeEnabled();
  // 只验证上传和识别，不向榜单写入测试战绩。
  await page.screenshot({ path: 'test-results/upload-ocr.png', fullPage: true, animations: 'disabled' });
});
