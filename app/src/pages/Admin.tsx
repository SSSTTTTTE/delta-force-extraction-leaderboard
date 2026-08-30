import { useEffect, useState } from "react";
import { Link } from "react-router";
import "./admin.css";
import type { AdminPlayer } from "@/types/leaderboard";
import {
  adminAdjust,
  adminDeleteEntry,
  adminDeletePlayer,
  adminFetchPlayers,
  adminLogin,
  clearAdminToken,
  formatValue,
  getAdminToken,
} from "@/services/leaderboardApi";

function formatTime(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Admin() {
  const [authed, setAuthed] = useState(() => getAdminToken() !== null);
  const [password, setPassword] = useState("");
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      const d = await adminFetchPlayers();
      setPlayers(d.players);
      setEdits(Object.fromEntries(d.players.map((p) => [p.playerId, String(p.total)])));
    } catch (e) {
      if (e instanceof Error && e.message.includes("未授权")) {
        setAuthed(false);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  const login = async () => {
    setError(null);
    try {
      await adminLogin(password);
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveTotal = async (playerId: string) => {
    setError(null);
    setNotice(null);
    const total = Number((edits[playerId] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(total) || total < 0) {
      setError("总值必须是非负数字");
      return;
    }
    try {
      await adminAdjust(playerId, total);
      setNotice(`已调整 ${playerId} 的总值为 ${formatValue(total)}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeEntry = async (playerId: string, index: number, value: number, ts: string) => {
    if (!window.confirm(`确认删除 ${playerId} 的这条记录（+${formatValue(value)}）？将同时扣减总值。`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await adminDeleteEntry(playerId, index, { value, ts });
      setNotice("记录已删除");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removePlayer = async (playerId: string) => {
    if (!window.confirm(`确认删除玩家 ${playerId} 及其全部提交记录？此操作不可恢复。`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await adminDeletePlayer(playerId);
      setOpenId(null);
      setNotice(`玩家 ${playerId} 及其全部记录已删除`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!authed) {
    return (
      <div className="adm-root">
        <div className="adm-card adm-login">
          <h1 className="adm-title">管理员登录</h1>
          <input
            className="adm-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="请输入管理密码"
            autoFocus
          />
          <button className="adm-btn" onClick={login}>
            登录
          </button>
          {error && <div className="adm-msg adm-msg-err">{error}</div>}
          <Link className="adm-link" to="/">
            ← 返回排行榜
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-root">
      <div className="adm-card">
        <div className="adm-head">
          <h1 className="adm-title">榜单管理</h1>
          <div className="adm-head-actions">
            <button className="adm-btn adm-btn-ghost" onClick={load}>
              刷新
            </button>
            <button
              className="adm-btn adm-btn-ghost"
              onClick={() => {
                clearAdminToken();
                setAuthed(false);
              }}
            >
              退出登录
            </button>
            <Link className="adm-link" to="/">
              ← 返回排行榜
            </Link>
          </div>
        </div>

        {error && <div className="adm-msg adm-msg-err">{error}</div>}
        {notice && <div className="adm-msg adm-msg-ok">{notice}</div>}

        {!players && <div className="adm-loading">加载中…</div>}
        {players?.length === 0 && <div className="adm-loading">暂无数据</div>}

        {players?.map((p, i) => (
          <div key={p.playerId} className="adm-player">
            <div className="adm-player-row">
              <span className="adm-rank">{i + 1}</span>
              <span className="adm-pid">{p.playerId}</span>
              <input
                className="adm-input adm-total"
                value={edits[p.playerId] ?? ""}
                onChange={(e) =>
                  setEdits((prev) => ({ ...prev, [p.playerId]: e.target.value.replace(/[^\d,]/g, "") }))
                }
                inputMode="numeric"
              />
              <button className="adm-btn adm-btn-sm" onClick={() => saveTotal(p.playerId)}>
                保存总值
              </button>
              <button
                className="adm-btn adm-btn-sm adm-btn-ghost"
                onClick={() => setOpenId(openId === p.playerId ? null : p.playerId)}
              >
                {openId === p.playerId ? "收起记录" : `提交记录（${p.history.length}）`}
              </button>
              <button className="adm-btn adm-btn-sm adm-btn-danger" onClick={() => removePlayer(p.playerId)}>
                删除玩家
              </button>
            </div>
            {openId === p.playerId && (
              <div className="adm-entries">
                {p.history.length === 0 && (
                  <div className="adm-entry adm-entry-empty">无提交记录（总值为历史遗留或直接调整）</div>
                )}
                {[...p.history].reverse().map((h) => (
                  <div key={h.index} className="adm-entry">
                    <span className="adm-entry-time">{formatTime(h.ts)}</span>
                    <span className="adm-entry-value">+{formatValue(h.value)}</span>
                    <button
                      className="adm-btn adm-btn-sm adm-btn-danger"
                      onClick={() => removeEntry(p.playerId, h.index, h.value, h.ts)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
