import { expect, test } from '@playwright/test';
import { parseScoreboard, type OcrWord } from '../src/services/ocr';

const word = (text: string, left: number, top: number, width: number, height: number): OcrWord =>
  ({ text, left, top, width, height });

test('昵称裁剪保留拆词后的完整中文名，并排除上方状态和左侧头像', () => {
  const result = parseScoreboard([
    word('头像残影', 119, 456, 57, 57),
    word('撤离', 213, 471, 32, 16),
    word('成功', 245, 471, 32, 16),
    word('小帅', 213, 498, 32, 16),
    word('捣蛋', 245, 498, 32, 16),
    word('17,824,438', 397, 486, 117, 19),
    word('队友', 213, 613, 32, 16),
    word('4,153,211', 397, 601, 104, 20),
  ]);
  expect(result?.playerId).toBe('小帅捣蛋');
  expect(result?.nameRegion?.left).toBeLessThan(213);
  expect(result?.nameRegion?.left).toBeGreaterThan(176);
  expect(result?.nameRegion?.top).toBeGreaterThan(487);
  expect(result?.nameRegion?.top).toBeLessThan(498);
});

for (const scale of [0.5, 1, 2]) {
  test(`整图漏读单字昵称时，${scale} 倍分辨率的裁剪仍包含昵称首字`, () => {
    const words = [
      word('a', 213, 471, 64, 43),
      word('17,824,438', 397, 486, 117, 19),
    ].map((w) => ({ ...w, left: w.left * scale, top: w.top * scale, width: w.width * scale, height: w.height * scale }));
    const region = parseScoreboard(words)?.nameRegion;
    expect(region).toBeTruthy();
    expect(region!.left).toBeLessThan(213 * scale);
    expect(region!.left + region!.width).toBeGreaterThan(229 * scale);
    expect(region!.top).toBeGreaterThan(487 * scale);
    expect(region!.top).toBeLessThan(498 * scale);
    expect(region!.top + region!.height).toBeGreaterThan(514 * scale);
  });
}

test('没有识别出金额时返回 null', () => {
  expect(parseScoreboard([word('撤离成功', 213, 471, 64, 16)])).toBeNull();
});
