import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./player-chart.css";
import type { PlayerHistoryResponse } from "@/types/leaderboard";
import { fetchPlayerHistory, formatValue } from "@/services/leaderboardApi";

interface Point {
  n: number;
  total: number;
  delta: number;
}

/** 点击 ID 展开的最近十次带出价值上涨曲线（累计值） */
export default function PlayerChart({ playerId }: { playerId: string }) {
  const [data, setData] = useState<PlayerHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPlayerHistory(playerId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [playerId]);

  if (error) return <div className="chart-msg">加载失败：{error}</div>;
  if (!data) return <div className="chart-msg">曲线加载中…</div>;
  if (data.entries.length === 0) return <div className="chart-msg">暂无提交记录</div>;

  // 由最近若干次增量反推累计曲线
  const sum = data.entries.reduce((a, e) => a + e.value, 0);
  let acc = data.total - sum;
  const points: Point[] = data.entries.map((e, i) => {
    acc += e.value;
    return { n: i + 1, total: acc, delta: e.value };
  });

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
          <CartesianGrid stroke="rgba(120, 190, 155, 0.12)" vertical={false} />
          <XAxis dataKey="n" hide />
          <YAxis
            width={70}
            tick={{ fill: "rgba(170, 196, 182, 0.6)", fontSize: 11 }}
            tickFormatter={(v: number) => formatValue(v)}
            axisLine={false}
            tickLine={false}
            domain={["dataMin", "dataMax"]}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(8, 14, 12, 0.95)",
              border: "1px solid rgba(47, 214, 140, 0.35)",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ display: "none" }}
            formatter={(value: number | string, name: string) => [
              formatValue(Number(value)),
              name === "total" ? "累计价值" : name,
            ]}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#2fe394"
            strokeWidth={2}
            dot={{ r: 3, fill: "#2fe394", strokeWidth: 0 }}
            activeDot={{ r: 4, fill: "#b7ffe0", strokeWidth: 0 }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
