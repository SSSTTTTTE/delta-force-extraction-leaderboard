import type { LeaderboardEntry } from "@/types/leaderboard";
import SlotNumber from "@/components/SlotNumber";

export const BADGES: Record<number, string> = {
  1: "/assets/badge1.png",
  2: "/assets/badge2.png",
  3: "/assets/badge3.png",
};

const EMBLEMS: Record<number, string> = {
  1: "/assets/emblem_gold.png",
  2: "/assets/emblem_silver.png",
  3: "/assets/emblem_bronze.png",
};

export interface PodiumLayout {
  tabTop: number;
  cardTop: number;
  cardHeight: number;
  emblemTop: number;
  pidTop: number;
  labelTop: number;
  valueTop: number;
  baseTop: number;
  baseWidth: number;
}

export interface PodiumConf {
  className: "gold" | "silver" | "bronze";
  style: React.CSSProperties;
  tabClass: string;
  valueClass: string;
  emblemWidth: number;
  crown?: boolean;
  layout: PodiumLayout;
}

/** 前三名领奖台配置：key 为名次（基于 1024x1536 设计稿坐标系） */
export const PODIUM_CONF: Record<number, PodiumConf> = {
  2: {
    className: "silver",
    style: { left: 75, top: 246, width: 305, height: 400 },
    tabClass: "tab-silver",
    valueClass: "pvalue-v2",
    emblemWidth: 156,
    layout: {
      tabTop: 0,
      cardTop: 42,
      cardHeight: 312,
      emblemTop: 80,
      pidTop: 222,
      labelTop: 254,
      valueTop: 276,
      baseTop: 356,
      baseWidth: 340,
    },
  },
  1: {
    className: "gold",
    style: { left: 330, top: 176, width: 370, height: 470 },
    tabClass: "tab-gold",
    valueClass: "pvalue-v1",
    emblemWidth: 170,
    crown: true,
    layout: {
      tabTop: 30,
      cardTop: 78,
      cardHeight: 360,
      emblemTop: 122,
      pidTop: 278,
      labelTop: 310,
      valueTop: 330,
      baseTop: 440,
      baseWidth: 430,
    },
  },
  3: {
    className: "bronze",
    style: { left: 665, top: 282, width: 285, height: 360 },
    tabClass: "tab-bronze",
    valueClass: "pvalue-v3",
    emblemWidth: 142,
    layout: {
      tabTop: 0,
      cardTop: 36,
      cardHeight: 284,
      emblemTop: 74,
      pidTop: 204,
      labelTop: 236,
      valueTop: 256,
      baseTop: 322,
      baseWidth: 300,
    },
  },
};

/** 领奖台卡片簇在 1024x1536 设计稿中的包围盒（横屏布局复用） */
export const PODIUM_CLUSTER = { x: 75, y: 176, w: 875, h: 470 };

export function Podium({ entry, conf }: { entry: LeaderboardEntry; conf: PodiumConf }) {
  const { layout } = conf;
  return (
    <div className={`podium ${conf.className}`} style={conf.style}>
      {conf.crown && (
        <img className="crown" src="/assets/crown.png" style={{ top: 0, width: 72 }} alt="" />
      )}
      <div className={`tab ${conf.tabClass}`} style={{ top: layout.tabTop }}>
        <span>{entry.rank}</span>
      </div>
      <div
        className={`pcard pcard-${conf.className}`}
        style={{ top: layout.cardTop, height: layout.cardHeight }}
      >
        <div className="pcard-in" />
        <div className="sheen" />
      </div>
      <img
        className="emblem"
        src={EMBLEMS[entry.rank]}
        style={{ top: layout.emblemTop, width: conf.emblemWidth }}
        alt=""
      />
      <div className="pid" style={{ top: layout.pidTop }}>
        ID: {entry.playerId}
      </div>
      <div className="plabel" style={{ top: layout.labelTop }}>
        带出总价值
      </div>
      <div className={`pvalue ${conf.valueClass}`} style={{ top: layout.valueTop }}>
        <SlotNumber value={entry.value} />
      </div>
      <div className="pbase" style={{ top: layout.baseTop, width: layout.baseWidth, height: 30 }}>
        <div
          className={`glow glow-${conf.className}`}
          style={{ width: layout.baseWidth - 40, height: 60 }}
        />
        <div className={`plat plat-${conf.className}`} style={{ height: 26 }} />
        <div className={`streak streak-${conf.className}`} />
      </div>
    </div>
  );
}
