import { PSM, type Worker } from "tesseract.js";
import { pickName, parseScoreboard, type CropRegion, type OcrWord } from "@/services/ocr";

export interface RecognizeResult {
  playerId: string;
  value: number;
}

/**
 * 名字区域二次精识别：整图 OCR 对「小号浅灰中文」识别很差，
 * 把名字所在区域裁出来放大 3 倍并反色（黑字白底）后，
 * 用稀疏文本模式单独再识别一次。
 */
async function refineName(
  file: File | Blob,
  region: CropRegion,
  worker: Worker,
): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    bmp,
    region.left,
    region.top,
    region.width,
    region.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bmp.close();
  // 反色：深色底浅色字 -> 白底黑字，显著提升 Tesseract 准确率
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(img, 0, 0);

  // 稀疏文本模式对「小号浅灰文字 + 加粗状态行」的混合区域识别效果最好
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  try {
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    // 按行过滤：丢弃整体位于名字列左边界（anchorX）左侧的行——那是屏幕左缘的悬浮 overlay 文字
    const lines = (data.blocks ?? []).flatMap((b) =>
      b.paragraphs.flatMap((p) =>
        p.lines.map((l) => ({
          text: l.text,
          // 行在原图中的左边界 x
          x: region.left + l.bbox.x0 / scale,
        })),
      ),
    );
    const kept = lines.filter((l) => l.x >= region.anchorX - 8);
    const source = kept.length > 0 ? kept : lines;
    const refined = pickName(source.map((l) => l.text).join("\n"));
    if (refined) return refined;
    // blocks 不可用时退回纯文本
    const fallback = pickName(data.text ?? "");
    if (fallback) return fallback;
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  }
  // 稀疏模式没读出内容时退回到单块模式再试一次
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  try {
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: false });
    return pickName(data.text ?? "");
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  }
}

/**
 * 识别一张战绩截图：整图定位带出价值最高的行，裁剪名字区域二次精识别。
 * 识别不到任何价值数字时返回 null。
 */
export async function recognizeScore(
  file: File | Blob,
  worker: Worker,
  onProgress?: (progress: number) => void,
): Promise<RecognizeResult | null> {
  void onProgress;
  // 显式使用 AUTO 分页模式：v7 默认模式对多行表格分词很差，
  // 会导致状态词锚点失效、名字行被合并成乱码
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  const { data } = await worker.recognize(file, {}, { blocks: true, text: false });
  // v7 结构：blocks -> paragraphs -> lines -> words，拍平成词列表
  const words: OcrWord[] = (data.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) =>
      p.lines.flatMap((l) =>
        l.words.map((w) => ({
          text: w.text,
          left: w.bbox.x0,
          top: w.bbox.y0,
          width: w.bbox.x1 - w.bbox.x0,
          height: w.bbox.y1 - w.bbox.y0,
        })),
      ),
    ),
  );
  const parsed = parseScoreboard(words);
  if (!parsed) return null;
  let playerId = parsed.playerId;
  if (parsed.nameRegion) {
    try {
      const refined = await refineName(file, parsed.nameRegion, worker);
      if (refined) playerId = refined;
    } catch {
      // 精识别失败时沿用整图识别结果
    }
  }
  return { playerId, value: parsed.value };
}
