import { useEffect, useState } from "react";
import type { LeaderboardResponse } from "@/types/leaderboard";
import { fetchLeaderboard } from "@/services/leaderboardApi";
import WideBoard from "@/WideBoard";
import MobileBoard from "@/MobileBoard";

/** 视口宽高比超过该值时切换为横屏布局 */
const WIDE_ASPECT = 1.2;

/** 数据刷新间隔：每分钟 */
const REFRESH_MS = 60_000;

export default function App() {
  const [wide, setWide] = useState(false);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState(() => Date.now() + REFRESH_MS);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000);

  useEffect(() => {
    const update = () => {
      setWide(window.innerWidth / window.innerHeight >= WIDE_ASPECT);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchLeaderboard().then((d) => {
        if (alive) {
          setData(d);
          setNextRefreshAt(Date.now() + REFRESH_MS);
        }
      });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // 刷新倒计时，每秒跳动
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [nextRefreshAt]);

  return wide ? (
    <WideBoard data={data} secondsLeft={secondsLeft} />
  ) : (
    <MobileBoard data={data} secondsLeft={secondsLeft} />
  );
}
