import { useState } from "react";
import { Link } from "react-router";
import "./leaderboard.css";
import "./leaderboard-mobile.css";
import type { LeaderboardEntry, LeaderboardResponse } from "@/types/leaderboard";
import SlotNumber from "@/components/SlotNumber";
import PlayerChart from "@/components/PlayerChart";
import { BADGES } from "@/components/Podium";

const EMBLEMS: Record<number, string> = {
  1: "/assets/emblem_gold.png",
  2: "/assets/emblem_silver.png",
  3: "/assets/emblem_bronze.png",
};

/** 榜单最多展示条数 */
const MAX_ROWS = 10;

function MiniCard({ entry, delay }: { entry: LeaderboardEntry; delay: number }) {
  return (
    <div
      className={`mb-mini mb-mini-${entry.rank}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`mb-mini-tab mb-tab-${entry.rank}`}>{entry.rank}</div>
      <img className="mb-mini-emblem" src={EMBLEMS[entry.rank]} alt="" />
      <div className="mb-pid">ID: {entry.playerId}</div>
      <div className="mb-plabel">带出总价值</div>
      <div className={`mb-pvalue mb-pvalue-${entry.rank}`}>
        <SlotNumber value={entry.value} />
      </div>
    </div>
  );
}

export default function MobileBoard({
  data,
  secondsLeft,
}: {
  data: LeaderboardResponse | null;
  secondsLeft?: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const entries = (data?.entries ?? []).slice(0, MAX_ROWS);
  const top1 = entries.find((e) => e.rank === 1);
  const top2 = entries.find((e) => e.rank === 2);
  const top3 = entries.find((e) => e.rank === 3);

  return (
    <div className="mb-root">
      <div className="mb-bg" />
      <div className="mb-inner">
        {/* 顶部 */}
        <div className="mb-top">
          <img className="mb-logo" src="/assets/logo.png" alt="三角洲行动" />
          <div className="mb-top-right">
            <div className="mb-hud">
              TACTICAL BOARD · LV.19 / S
              <br />
              EXTRACTION RECORD
            </div>
            <Link className="mb-admin" to="/admin">
              管理员登录
            </Link>
          </div>
        </div>

        {/* 标题 */}
        <div className="mb-title-wrap">
          <div className="lb-title-frame">
            <i className="corner c-tl" />
            <i className="corner c-tr" />
            <i className="corner c-bl" />
            <i className="corner c-br" />
            <i className="diamond d-l" />
            <i className="diamond d-r" />
            <h1 className="lb-title mb-title">{data?.title ?? "KASA电竞带出价值排行榜"}</h1>
          </div>
        </div>

        {/* 第一名 */}
        {top1 && (
          <div className="mb-hero">
            <img className="mb-crown" src="/assets/crown.png" alt="" />
            <div className="mb-hero-tab">1</div>
            <img className="mb-hero-emblem" src={EMBLEMS[1]} alt="" />
            <div className="mb-pid">ID: {top1.playerId}</div>
            <div className="mb-plabel">带出总价值</div>
            <div className="mb-pvalue mb-pvalue-1">
              <SlotNumber value={top1.value} />
            </div>
          </div>
        )}

        {/* 第二、三名 */}
        {(top2 || top3) && (
          <div className="mb-duo">
            {top2 && <MiniCard entry={top2} delay={150} />}
            {top3 && <MiniCard entry={top3} delay={280} />}
          </div>
        )}

        {/* 榜单（前十） */}
        <div className="mb-panel">
          <div className="mb-head">
            <span className="hc hc-rank">排名</span>
            <span className="hc hc-id">ID</span>
            <span className="hc hc-val">带出总价值</span>
          </div>
          {entries.length === 0 && <div className="mb-loading">数据加载中…</div>}
          {entries.map((r, i) => (
            <div key={r.playerId} className="mb-rowwrap" style={{ animationDelay: `${i * 60}ms` }}>
              <div
                className={`mb-row${r.rank === 1 ? " mb-row-top1" : ""}`}
                onClick={() => setExpanded(expanded === r.playerId ? null : r.playerId)}
              >
                <span className="rank">
                  {BADGES[r.rank] ? <img src={BADGES[r.rank]} alt={`${r.rank}`} /> : r.rank}
                </span>
                <span className="rid">{r.playerId}</span>
                <span className="rval">
                  <SlotNumber value={r.value} />
                </span>
              </div>
              {expanded === r.playerId && (
                <div className="mb-expand">
                  <PlayerChart playerId={r.playerId} />
                </div>
              )}
            </div>
          ))}
          <div className="mb-panel-foot">{"数据 " + (secondsLeft ?? "—") + " 秒后更新"}</div>
        </div>

        {/* 底部 */}
        <div className="mb-footer">
          <span className="mb-footer-logo">DELTA FORCE</span>
          <span className="mb-footer-sub">EXTRACTION VALUE RANKING</span>
        </div>
      </div>
    </div>
  );
}
