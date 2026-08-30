const NOISE_RE = /撤离失败|撤离成功|任务完成|带出价值|击败干员|其他敌方|救助|复活|生存时长|成就|战绩详情|淘汰详情|行动收获|击败列表|目标|对局时间|击杀者|分钟/g;
const VALUE_TOKEN_RE = /^\d{1,3}(,\d{3})*$/;
function parseValueToken(text) {
  const t = text.trim();
  if (!VALUE_TOKEN_RE.test(t)) return null;
  return Number(t.replace(/,/g, ""));
}
function parseScoreboard(words) {
  const candidates = words.map((w) => ({ word: w, value: parseValueToken(w.text) })).filter((x) => x.value !== null);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.value - a.value);
  const best = candidates[0];
  const cy = best.word.top + best.word.height / 2;
  const bandTop = cy - best.word.height * 2.2;
  const bandBottom = cy + best.word.height * 2.2;
  const nameParts = words.filter((w) => {
    const wc = w.top + w.height / 2;
    return wc > bandTop && wc < bandBottom && w.left + w.width < best.word.left - 20 && w.text.trim().length > 0 && !VALUE_TOKEN_RE.test(w.text.trim());
  }).sort((a, b) => a.top - b.top || a.left - b.left).map((w) => w.text.trim());
  const playerId = nameParts.join("").replace(NOISE_RE, "").trim();
  return { playerId, value: best.value };
}
export {
  parseScoreboard
};
