/**
 * 战绩截图 OCR 解析。
 *
 * 截图是一张多行表格，每行包含：玩家 ID（第一列，通常是两行文字：
 * 上面是「撤离失败/撤离成功」状态，下面是玩家 ID）和「带出价值」列
 * （千分位数字，如 60,878 / 3,615,217）。
 *
 * 解析策略：在所有识别词中找到数值最大的「价值」token，然后在同一行
 * 的纵向区间内、价值列左侧收集玩家 ID 文字。
 */

export interface OcrWord {
  text: string;
  /** 左边界 x */
  left: number;
  /** 上边界 y */
  top: number;
  width: number;
  height: number;
}

export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 名字列的左边界（原图 x 坐标）：二次识别时丢弃明显位于此线左侧的行（悬浮 overlay 文字等） */
  anchorX: number;
}

export interface ParsedScore {
  playerId: string;
  value: number;
  /** 玩家 ID 文字所在区域（相对原图像素），用于裁剪后二次精识别 */
  nameRegion: CropRegion | null;
}

/** 状态/表头等需要剔除的词 */
const NOISE_RE = /撤离失败|撤离成功|任务完成|带出价值|击败干员|其他敌方|救助|复活|生存时长|成就|战绩详情|淘汰详情|行动收获|击败列表|目标|对局时间|击杀者|分钟/g;

/** 纯数字（小数值）："0" / "878"；限 7 位以内，更长的纯数字串是 overlay 里的对局 ID 而非价值 */
const PLAIN_NUM_RE = /^\d{1,7}$/;
/** 千分位分组：容忍 OCR 把逗号误识别为 / . ' 等："15,854,789" 被读成 "-15/854,789" 也能提取 */
const GROUPED_NUM_RE = /\d{1,3}[.,\\/'，、']\d{3}(?:[.,\\/'，、']\d{3})*/;

function parseValueToken(text: string): number | null {
  const t = text.trim();
  if (PLAIN_NUM_RE.test(t)) return Number(t);
  const m = t.match(GROUPED_NUM_RE);
  if (m) return Number(m[0].replace(/\D/g, ""));
  return null;
}

/**
 * 从 OCR 词列表中找出带出价值最高的玩家。
 * 找不到任何价值数字时返回 null。
 */
export function parseScoreboard(words: OcrWord[]): ParsedScore | null {
  const candidates = words
    .map((w) => ({ word: w, value: parseValueToken(w.text) }))
    .filter((x): x is { word: OcrWord; value: number } => x.value !== null);
  if (candidates.length === 0) return null;

  // 数值最大的即为本局最高带出价值
  candidates.sort((a, b) => b.value - a.value);
  const best = candidates[0];

  // 以价值 token 的纵向中心为基准，向上下各扩约两个字高，圈定该行区域
  const cy = best.word.top + best.word.height / 2;
  const bandTop = cy - best.word.height * 2.2;
  const bandBottom = cy + best.word.height * 2.2;

  const rowWords = words
    .filter((w) => {
      const wc = w.top + w.height / 2;
      return (
        wc > bandTop &&
        wc < bandBottom &&
        w.left + w.width < best.word.left - 20 &&
        w.text.trim().length > 0
      );
    })
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const nameParts = rowWords
    .filter((w) => parseValueToken(w.text) === null)
    .map((w) => w.text.trim());

  const playerId = cleanName(nameParts.join(""));

  // 定位名字区域供二次精识别：以「撤离失败/撤离成功」状态词为锚点，
  // 裁剪范围覆盖状态行和名字行（状态词会在清洗时被剔除）；
  // 找不到状态词时按固定列距估算名字列位置（名字列约在价值列左侧 175px），
  // 同时避开左侧头像和屏幕左缘的悬浮 overlay 文字
  const status = rowWords.find((w) => /撤|撒|搬|成功|失败|成力/.test(w.text));
  let nameRegion: CropRegion | null = null;
  if (status) {
    const left = Math.max(0, status.left - 8);
    const width = best.word.left - 30 - left;
    if (width > 0) {
      nameRegion = {
        left,
        top: Math.max(0, status.top - 4),
        width,
        height: status.height * 4,
        anchorX: status.left,
      };
    }
  } else {
    const bandH = bandBottom - bandTop;
    const left = Math.max(bandH, best.word.left - 175); // 名字列约位置，兼跳过头像
    const width = best.word.left - 20 - left;
    if (width > 0) {
      nameRegion = { left, top: bandTop, width, height: bandH, anchorX: left };
    }
  }

  return { playerId, value: best.value, nameRegion };
}

/** 清洗识别出的名字：去掉空白和状态/表头噪声词 */
export function cleanName(text: string): string {
  return text.replace(/\s+/g, "").replace(NOISE_RE, "").trim();
}

const CJK_RE = /[一-鿿]/;

/**
 * OCR 常把字母 o 误识别为数字 0：当名字里含有拉丁字母、且 0 前面紧跟
 * 字母/汉字、后面不是数字时修正（oy0 → oyo、神秘0yo → 神秘oyo；
 * Dank1ng64、007、夜袭0号 等不受影响）。
 */
function fixOcrOZero(name: string): string {
  if (!/[a-zA-Z]/.test(name)) return name;
  return name.replace(/(?<=[a-zA-Z一-鿿])0(?!\d)/g, "o");
}

/**
 * 从多行 OCR 文本中挑出玩家 ID：
 * - 逐行清洗后，优先取含中文的最后一行（名字行在状态行下方）；
 * - 没有中文时取最后一个非空行（如 NITOCRIS 这类纯英文 ID）；
 * - 行内若中文前还有不含中文的垃圾 token（头像残影等），丢弃前缀。
 */
export function pickName(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((raw) => ({ raw, name: cleanName(raw) }))
    .filter((x) => x.name.length > 0);
  if (lines.length === 0) return "";
  const cjk = lines.filter((x) => CJK_RE.test(x.name));
  if (cjk.length === 0) {
    // 纯英文/数字 ID：取字母数字最多的一行（头像残影等垃圾行通常很短），并列时取靠后的
    let bestLine = lines[0];
    const score = (s: string) => (s.match(/[a-zA-Z0-9]/g) ?? []).length;
    for (const x of lines) {
      if (score(x.name) >= score(bestLine.name)) bestLine = x;
    }
    return fixOcrOZero(bestLine.name);
  }
  const chosen = cjk[cjk.length - 1];
  const tokens = chosen.raw.split(/\s+/).filter((t) => t.length > 0);
  const firstCjk = tokens.findIndex((t) => CJK_RE.test(t));
  if (firstCjk > 0) return fixOcrOZero(cleanName(tokens.slice(firstCjk).join("")));
  return fixOcrOZero(chosen.name);
}
