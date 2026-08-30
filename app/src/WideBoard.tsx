import { useEffect, useState } from "react";
import { Link } from "react-router";
import "./leaderboard.css";
import "./leaderboard-wide.css";
import type { LeaderboardResponse } from "@/types/leaderboard";
import SlotNumber from "@/components/SlotNumber";
import PlayerChart from "@/components/PlayerChart";
import { BADGES, Podium, PODIUM_CONF, PODIUM_CLUSTER } from "@/components/Podium";

/** 横屏设计稿坐标系 1600 x 900 */
const W = 1600;
const H = 900;

/** 领奖台簇在横屏中的放置区域（左侧，垂直方向与右侧面板居中对齐） */
const AREA = { x: 60, y: 262, w: 830, h: 520 };
const S = Math.min(AREA.w / PODIUM_CLUSTER.w, AREA.h / PODIUM_CLUSTER.h);

/** 榜单最多展示条数 */
const MAX_ROWS = 10;

export default function WideBoard({
  data,
  secondsLeft,
}: {
  data: LeaderboardResponse | null;
  secondsLeft?: number;
}) {
  const [scale, setScale] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const entries = (data?.entries ?? []).slice(0, MAX_ROWS);
  const top3 = entries.filter((e) => e.rank >= 1 && e.rank <= 3);

  // 面板高度按实际行数收缩并垂直居中，消除下方留白
  const rowCount = Math.max(entries.length, 1);
  const panelH = 52 + 46 * rowCount + 52;
  const panelTop = 140 + (690 - panelH) / 2;

  return (
    <div className="lb-root">
      <div className="lb-viewport" style={{ width: W * scale, height: H * scale }}>
        <div className="lb-stage lw-stage" style={{ transform: `scale(${scale})` }}>
          {/* 背景 */}
          <div className="lb-bg" />

          {/* 顶部 */}
          <img className="lb-logo" src="/assets/logo.png" alt="三角洲行动" />
          <div className="lb-hud-right">
            SYS.CHECKSUM // OK&nbsp;&nbsp;UID:8285-JD
            <br />
            TACTICAL BOARD&nbsp;&nbsp;·&nbsp;&nbsp;LV.19 / S
          </div>
          <div className="lb-hud-left">DELTA FORCE // EXTRACTION RECORD</div>
          <Link className="lw-admin" to="/admin">
            管理员登录
          </Link>

          {/* 标题 */}
          <div className="lw-title-wrap">
            <div className="lb-title-frame">
              <i className="corner c-tl" />
              <i className="corner c-tr" />
              <i className="corner c-bl" />
              <i className="corner c-br" />
              <i className="diamond d-l" />
              <i className="diamond d-r" />
              <h1 className="lb-title lw-title">{data?.title ?? "KASA电竞带出价值排行榜"}</h1>
            </div>
          </div>

          {/* 领奖台：整体复用竖屏设计，缩放后放入左侧区域 */}
          <div
            className="lw-podium-area"
            style={{
              left: AREA.x,
              top: AREA.y,
              width: PODIUM_CLUSTER.w * S,
              height: PODIUM_CLUSTER.h * S,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -PODIUM_CLUSTER.x * S,
                top: -PODIUM_CLUSTER.y * S,
                width: 1024,
                height: 1536,
                transform: `scale(${S})`,
                transformOrigin: "top left",
              }}
            >
              {/* 铜/银/金顺序渲染，金牌在最上层（三者卡片存在重叠区） */}
              {[3, 2, 1].map((rank) => {
                const entry = top3.find((e) => e.rank === rank);
                return entry ? <Podium key={rank} entry={entry} conf={PODIUM_CONF[rank]} /> : null;
              })}
            </div>
          </div>

          {/* 榜单面板（右侧，前十；高度随行数收缩） */}
          <div className="lw-panel" style={{ top: panelTop, height: panelH }}>
            <div className="lw-panel-in">
              <div className="lw-head">
                <span className="hc hc-rank">排名</span>
                <span className="hc hc-id">ID</span>
                <span className="hc hc-val">
                  带出总价值
                  <span className="sort-ico">
                    <i className="up" />
                    <i className="down" />
                  </span>
                </span>
              </div>
              <div className="lw-rows">
                {entries.length === 0 && <div className="lb-loading">数据加载中…</div>}
                {entries.map((r, i) => (
                  <div
                    key={r.playerId}
                    className="lw-rowwrap"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div
                      className={`lw-row${r.rank === 1 ? " lw-row-top1" : ""}`}
                      onClick={() => setExpanded(expanded === r.playerId ? null : r.playerId)}
                    >
                      <span className="rank">
                        {BADGES[r.rank] ? (
                          <img src={BADGES[r.rank]} alt={`${r.rank}`} />
                        ) : (
                          r.rank
                        )}
                      </span>
                      <span className="rid">{r.playerId}</span>
                      <span className="rval">
                        <SlotNumber value={r.value} />
                      </span>
                    </div>
                    {expanded === r.playerId && (
                      <div className="lw-expand">
                        <PlayerChart playerId={r.playerId} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="lw-panel-foot">
                <span className="dash" />
                {"数据 " + (secondsLeft ?? "—") + " 秒后更新"}
                <span className="dash dash-r" />
              </div>
            </div>
          </div>

          {/* 底部条 */}
          <div className="lb-footer">
            <i className="f-compass" />
            <div className="f-left">
              <span className="f-logo-txt">DELTA FORCE</span>
              <span className="f-sub">EXTRACTION VALUE RANKING · SEASON ARCHIVE</span>
            </div>
            <i className="f-barcode" />
            <img className="f-tri" src="/assets/tri.png" alt="" />
          </div>
        </div>
      </div>
    </div>
  );
}
