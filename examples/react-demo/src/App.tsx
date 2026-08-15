import { useState } from "react";
import { useMurmur } from "@murmur/react";

const SAMPLE_IMAGES = [
  "https://picsum.photos/seed/murmur-a/256",
  "https://picsum.photos/seed/murmur-b/256",
  "https://picsum.photos/seed/murmur-c/256",
];

const statusColor: Record<string, string> = {
  idle: "#6b7280",
  connecting: "#f59e0b",
  registered: "#22c55e",
  disconnected: "#ef4444",
};

export function App() {
  const murmur = useMurmur();
  const [image, setImage] = useState(SAMPLE_IMAGES[0]!);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = murmur.completions[0];

  const runTask = async () => {
    setRunning(true);
    setError(null);
    try {
      await murmur.requestTask({ model: "moderation-v1", input: image, timeoutMs: 15_000 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "task failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 32 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Murmur</h1>
        <span style={{ fontSize: 12, color: statusColor[murmur.status] ?? "#9ca3af" }}>● {murmur.status}</span>
        <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{murmur.clientId?.slice(0, 8)}</span>
      </header>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Workers ({murmur.workers.length})</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {murmur.workers.length === 0 && (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>
              Waiting for browsers to register… open this page in more tabs.
            </p>
          )}
          {murmur.workers.map((w) => (
            <div key={w.clientId} style={{ border: "1px solid #27272a", borderRadius: 8, padding: 10, fontSize: 12 }}>
              <div style={{ fontFamily: "monospace", color: "#e5e7eb" }}>{w.clientId.slice(0, 8)}</div>
              <div style={{ color: w.status === "busy" ? "#f59e0b" : "#22c55e" }}>{w.status}</div>
              <div style={{ color: "#9ca3af" }}>{w.capabilities.runtime}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>New moderation task</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SAMPLE_IMAGES.map((url) => (
            <button
              key={url}
              onClick={() => setImage(url)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                border: image === url ? "2px solid #3b82f6" : "1px solid #27272a",
                borderRadius: 6,
                background: "#18181b",
                color: "#e5e7eb",
                fontSize: 12,
              }}
            >
              {url.split("/seed/")[1]}
            </button>
          ))}
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="or paste an image URL"
            style={{
              flex: 1,
              minWidth: 240,
              padding: "6px 10px",
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 6,
              color: "#e5e7eb",
              fontSize: 12,
            }}
          />
          <button
            onClick={runTask}
            disabled={running || murmur.status !== "registered"}
            style={{
              padding: "6px 16px",
              cursor: "pointer",
              border: "none",
              borderRadius: 6,
              background: running ? "#374151" : "#3b82f6",
              color: "white",
              fontSize: 12,
            }}
          >
            {running ? "Running…" : "Run task"}
          </button>
        </div>
        {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Latest consensus</h2>
        {latest ? (
          <div style={{ border: "1px solid #27272a", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  background: latest.label === "unsafe" ? "#7f1d1d" : "#14532d",
                  color: latest.label === "unsafe" ? "#fecaca" : "#bbf7d0",
                }}
              >
                {latest.label ?? String(latest.value)}
              </span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{latest.value.toFixed(3)}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>
                {latest.workers} workers · agreement {Math.round(latest.agreement * 100)}%
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {latest.results.map((r) => (
                <div
                  key={r.clientId}
                  style={{ border: "1px solid #27272a", borderRadius: 8, padding: 10, fontSize: 12 }}
                >
                  <div style={{ fontFamily: "monospace", color: "#e5e7eb" }}>{r.clientId.slice(0, 8)}</div>
                  <div>
                    score <b>{Number(r.output).toFixed(3)}</b>
                  </div>
                  <div style={{ color: "#9ca3af" }}>{Math.round(r.duration)}ms</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>
            No tasks completed yet. Open this page in 3 tabs, then run a task.
          </p>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>History</h2>
        {murmur.completions.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>No completed tasks.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13 }}>
            {murmur.completions.map((c) => (
              <li
                key={c.taskId}
                style={{ padding: "8px 0", borderBottom: "1px solid #1f1f23", display: "flex", gap: 16 }}
              >
                <span style={{ color: c.label === "unsafe" ? "#f87171" : "#4ade80" }}>
                  {c.label ?? String(c.value)}
                </span>
                <span style={{ color: "#9ca3af", fontFamily: "monospace" }}>{c.taskId.slice(0, 8)}</span>
                <span style={{ color: "#9ca3af" }}>
                  {c.value.toFixed(3)} · {c.workers} workers
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
