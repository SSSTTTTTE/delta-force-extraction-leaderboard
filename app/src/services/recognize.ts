import { PSM, type Worker } from "tesseract.js";
import { pickName, parseScoreboard, type CropRegion, type OcrWord } from "@/services/ocr";

export interface RecognizeResult {
  playerId: string;
  value: number;
}

/** 裁剪并放大浅色小字，反色为黑字白底供二次识别。 */
async function prepareCrop(file: File | Blob, region: CropRegion): Promise<HTMLCanvasElement> {
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

  return canvas;
}

/** 单行模式能够保留「云」这样的单字昵称，稀疏文本模式会忽略它。 */
async function refineName(file: File | Blob, region: CropRegion, worker: Worker): Promise<string> {
  const canvas = await prepareCrop(file, region);
  try {
    for (const mode of [PSM.SINGLE_LINE, PSM.SINGLE_BLOCK]) {
      await worker.setParameters({ tessedit_pageseg_mode: mode, tessedit_char_whitelist: "" });
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: false });
      const name = pickName(data.text ?? "");
      if (name) return name;
    }
    return "";
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: "" });
  }
}

/** 金额独立放大识别，限制字符集，避免整图中的 6 / 8 等误读直接进入榜单。 */
async function refineValue(file: File | Blob, region: CropRegion, worker: Worker): Promise<number | null> {
  const canvas = await prepareCrop(file, region);
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: "0123456789,",
    });
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: false });
    const text = data.text.trim();
    // 必须完整读到一个金额，不能从残缺文本中截取部分数字。
    if (data.confidence < 70 || !/^(?:\d{1,3}(?:,\d{3})+|\d{1,9})$/.test(text)) return null;
    const value = Number(text.replace(/,/g, ""));
    return Number.isSafeInteger(value) ? value : null;
  } finally {
    // 同一 worker 会继续识别昵称及后续图片，不能残留数字白名单。
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: "" });
  }
}

/**
 * 识别一张战绩截图：整图定位带出价值最高的行，分别裁剪昵称和金额二次精识别。
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
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: "" });
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
  let value = parsed.value;
  try {
    value = await refineValue(file, parsed.valueRegion, worker) ?? value;
  } catch {
    // 放大复核失败时保留整图结果，让用户在提交前核对。
  }
  return { playerId, value };
}
