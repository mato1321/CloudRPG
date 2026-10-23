// @ts-nocheck
/* 前端錯誤回報：瀏覽器未捕捉的錯誤、路由錯誤畫面、SSR 渲染失敗都送到後端 /api/telemetry/error
 * （寫進伺服器 log；後端有設定 SENTRY_DSN 時會再轉送到 Sentry）。
 * 同一則錯誤 10 分鐘內只送一次，每 10 分鐘最多 20 則，避免錯誤迴圈灌爆後端 */
import { apiBase, getToken } from "./api";

const DEDUPE_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
const lastSent = new Map<string, number>();
let installed = false;

function shouldSend(key: string) {
  const now = Date.now();
  for (const [k, at] of lastSent) if (now - at > DEDUPE_MS) lastSent.delete(k);
  if (lastSent.has(key) || lastSent.size >= MAX_PER_WINDOW) return false;
  lastSent.set(key, now);
  return true;
}

function send(source: "browser" | "ssr", message: string, stack = "", url = "") {
  if (import.meta.env.DEV) return;
  if (!shouldSend(`${source}:${message.slice(0, 120)}`)) return;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = source === "browser" ? getToken() : null; // 讓 Sentry 知道是哪個玩家
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    fetch(`${apiBase()}/api/telemetry/error`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source,
        message: message.slice(0, 500),
        stack: String(stack || "").slice(0, 4000),
        url: String(url || "").slice(0, 300),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function describe(error: unknown) {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack || "" };
  return { message: String(error), stack: "" };
}

/** 回報已被畫面接住的錯誤（例如路由的錯誤畫面），這類錯誤不會觸發 window 的 error 事件 */
export function reportError(error: unknown) {
  if (typeof window === "undefined") return;
  const { message, stack } = describe(error);
  send("browser", message, stack, location.pathname);
}

/** SSR（前端 Node 伺服器）渲染失敗時回報 */
export function reportServerError(error: unknown, pathname = "") {
  const { message, stack } = describe(error);
  send("ssr", message, stack, pathname);
}

export function installErrorReporting() {
  if (installed || typeof window === "undefined" || import.meta.env.DEV) return;
  installed = true;
  window.addEventListener("error", (e) => send("browser", e.message || "error", e.error?.stack, location.pathname));
  window.addEventListener("unhandledrejection", (e) =>
    send("browser", String(e.reason?.message || e.reason), e.reason?.stack, location.pathname),
  );
}
