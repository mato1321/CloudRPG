// @ts-nocheck
/* 前端錯誤回報：未捕捉的錯誤送到後端 /api/telemetry/error（寫進伺服器 log），同一則錯誤只送一次 */
import { apiBase } from "./api";

let installed = false;
const seen = new Set<string>();

function report(message: string, stack = "") {
  const key = message.slice(0, 120);
  if (seen.has(key) || seen.size > 20) return;
  seen.add(key);
  try {
    fetch(`${apiBase()}/api/telemetry/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.slice(0, 500), stack: String(stack).slice(0, 4000), url: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export function installErrorReporting() {
  if (installed || typeof window === "undefined" || import.meta.env.DEV) return;
  installed = true;
  window.addEventListener("error", (e) => report(e.message || "error", e.error?.stack));
  window.addEventListener("unhandledrejection", (e) => report(String(e.reason?.message || e.reason), e.reason?.stack));
}
