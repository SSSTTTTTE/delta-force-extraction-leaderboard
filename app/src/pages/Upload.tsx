import { useRef, useState } from "react";
import { Link } from "react-router";
import { createWorker } from "tesseract.js";
import "./upload.css";
import { recognizeScore } from "@/services/recognize";
import { submitEntry } from "@/services/leaderboardApi";
import SlotNumber from "@/components/SlotNumber";

const MAX_FILES = 10;

type ItemStatus = "pending" | "recognizing" | "ready" | "error" | "done";

interface Item {
  key: string;
  file: File;
  url: string;
  status: ItemStatus;
  playerId: string;
  value: number | null;
  error: string | null;
}

let seq = 0;

const STATUS_TEXT: Record<ItemStatus, string> = {
  pending: "待识别",
  recognizing: "识别中…",
  ready: "待提交",
  error: "识别失败",
  done: "已提交 ✓",
};

export default function Upload() {
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchName, setBatchName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)));

  const pickFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setItems((prev) => {
      const room = MAX_FILES - prev.length;
      if (images.length > room) {
        setNotice(`最多上传 ${MAX_FILES} 张截图${room > 0 ? `，超出的 ${images.length - room} 张已忽略` : ""}`);
      }
      if (room <= 0) return prev;
      const added: Item[] = images.slice(0, room).map((f) => ({
        key: `${Date.now()}-${seq++}`,
        file: f,
        url: URL.createObjectURL(f),
        status: "pending",
        playerId: "",
        value: null,
        error: null,
      }));
      return [...prev, ...added];
    });
  };

  const removeItem = (key: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.key === key);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((x) => x.key !== key);
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const toggleSelect = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  /** 一键把选中条目的玩家 ID 统一改成输入的名字 */
  const applyBatchName = () => {
    const name = batchName.trim();
    if (!name || selected.size === 0) return;
    setItems((prev) =>
      prev.map((it) =>
        it.status === "ready" && selected.has(it.key) ? { ...it, playerId: name } : it,
      ),
    );
    setNotice(`已批量修改 ${selected.size} 条的玩家 ID 为「${name}」`);
  };

  const recognizeAll = async () => {
    const targets = items.filter((it) => it.status === "pending" || it.status === "error");
    if (targets.length === 0) return;
    setRunning(true);
    setNotice(null);
    setProgress(0);
    let idx = 0;
    const worker = await createWorker(["chi_sim", "eng"], 1, {
      // worker 脚本、wasm core、语言包全部走本地，避免 CDN 不稳定导致识别卡死
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract",
      langPath: "/tessdata",
      logger: (m) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          setProgress((idx + m.progress) / targets.length);
        }
      },
    });
    try {
      for (const it of targets) {
        patch(it.key, { status: "recognizing", error: null });
        try {
          const result = await recognizeScore(it.file, worker);
          if (!result) {
            patch(it.key, { status: "error", error: "未能识别出带出价值" });
          } else {
            patch(it.key, { status: "ready", playerId: result.playerId, value: result.value });
          }
        } catch (err) {
          patch(it.key, {
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
        idx++;
        setProgress(idx / targets.length);
      }
    } finally {
      await worker.terminate();
      setRunning(false);
    }
  };

  const submitAll = async () => {
    const targets = items.filter(
      (it) => it.status === "ready" && it.playerId.trim() && it.value !== null,
    );
    if (targets.length === 0) return;
    setSubmitting(true);
    setNotice(null);
    let ok = 0;
    let fail = 0;
    for (const it of targets) {
      try {
        await submitEntry(it.playerId.trim(), it.value!);
        patch(it.key, { status: "done" });
        ok++;
      } catch (err) {
        patch(it.key, {
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
        fail++;
      }
    }
    setNotice(`已提交 ${ok} 条${fail > 0 ? `，${fail} 条失败` : ""}，榜单已更新`);
    setSubmitting(false);
  };

  const pendingCount = items.filter((it) => it.status === "pending" || it.status === "error").length;
  const readyCount = items.filter(
    (it) => it.status === "ready" && it.playerId.trim() && it.value !== null,
  ).length;
  const readyKeys = items.filter((it) => it.status === "ready").map((it) => it.key);
  const allChecked = readyKeys.length > 0 && readyKeys.every((k) => selected.has(k));

  return (
    <div className="up-root">
      <div className="up-card">
        <h1 className="up-title">战绩上传</h1>
        <p className="up-desc">
          上传战绩截图（最多 {MAX_FILES} 张），自动识别每场带出价值最高的玩家及其价值，确认后累计到排行榜。
        </p>

        <div
          className="up-drop"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFiles(e.dataTransfer.files);
          }}
        >
          <span className="up-drop-hint">
            点击选择或拖拽战绩截图到这里（{items.length}/{MAX_FILES}）
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              pickFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {readyKeys.length > 0 && (
          <div className="up-batch">
            <label className="up-batch-check">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelected(checked ? new Set(readyKeys) : new Set());
                }}
              />
              全选
            </label>
            <span className="up-batch-count">已选 {selected.size} 项</span>
            <input
              className="up-batch-input"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="统一修改玩家 ID 为…"
            />
            <button
              className="up-btn up-btn-sm"
              onClick={applyBatchName}
              disabled={selected.size === 0 || !batchName.trim()}
            >
              一键修改
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="up-items">
            {items.map((it) => (
              <div key={it.key} className={`up-item up-item-${it.status}`}>
                {it.status === "ready" && (
                  <input
                    className="up-item-check"
                    type="checkbox"
                    checked={selected.has(it.key)}
                    onChange={(e) => toggleSelect(it.key, e.target.checked)}
                    title="选择后可批量修改玩家 ID"
                  />
                )}
                <img
                  className="up-thumb"
                  src={it.url}
                  alt="战绩截图"
                  title="点击查看大图"
                  onClick={() => setPreview(it.url)}
                />
                <div className="up-item-body">
                  <div className="up-item-status">{STATUS_TEXT[it.status]}</div>
                  {(it.status === "ready" || it.status === "done") && (
                    <>
                      <input
                        className="up-item-id"
                        value={it.playerId}
                        onChange={(e) => patch(it.key, { playerId: e.target.value })}
                        placeholder="玩家 ID（识别有误可修改）"
                        disabled={it.status === "done"}
                      />
                      {it.status === "ready" ? (
                        <input
                          className="up-item-id up-item-value-input"
                          value={it.value !== null ? String(it.value) : ""}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d]/g, "");
                            patch(it.key, { value: digits === "" ? null : Number(digits) });
                          }}
                          placeholder="带出价值（识别有误可修改）"
                          inputMode="numeric"
                          aria-label="带出价值"
                        />
                      ) : (
                        <div className="up-item-value" aria-label={`带出价值：${it.value?.toLocaleString("en-US") ?? "-"}`}>
                          带出价值：{it.value !== null ? <SlotNumber value={it.value} /> : "-"}
                        </div>
                      )}
                    </>
                  )}
                  {it.status === "error" && <div className="up-item-err">{it.error}</div>}
                </div>
                {it.status !== "recognizing" && (
                  <button className="up-item-del" onClick={() => removeItem(it.key)} title="移除">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {running && (
          <div className="up-progress">
            <div className="up-progress-bar">
              <div
                className="up-progress-fill"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span>识别中… {Math.round(progress * 100)}%（首次需加载语言包，请稍候）</span>
          </div>
        )}

        {items.length > 0 && (
          <div className="up-actions">
            <button
              className="up-btn"
              onClick={recognizeAll}
              disabled={running || submitting || pendingCount === 0}
            >
              {running ? "识别中…" : `开始识别（${pendingCount}）`}
            </button>
            <button
              className="up-btn"
              onClick={submitAll}
              disabled={running || submitting || readyCount === 0}
            >
              {submitting ? "提交中…" : `确认提交（${readyCount}）`}
            </button>
          </div>
        )}

        {notice && <div className="up-msg up-msg-ok">{notice}</div>}

        <Link className="up-link" to="/">
          查看排行榜 →
        </Link>
      </div>

      {/* 点击缩略图查看大图 */}
      {preview && (
        <div className="up-lightbox" onClick={() => setPreview(null)}>
          <img src={preview} alt="战绩截图大图" />
          <span className="up-lightbox-hint">点击任意处关闭</span>
        </div>
      )}
    </div>
  );
}
