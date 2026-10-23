// @ts-nocheck
/* ───────────── 前端呼叫後端 API 的共用工具 ─────────────
 * - API 位址：從 port 80 進入時走同一個網域（Nginx 轉發），其他 port 時連同主機的 :8000，可用 VITE_API_URL 覆蓋
 * - 自動帶 Authorization；401（登入過期）會清掉登入狀態並廣播 cloud-rpg-auth-change
 * - 錯誤一律丟出 ApiError，message 是後端給玩家看的中文 detail
 */
import { readAuth } from "./auth-utils";

export function apiBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window === "undefined") return "http://localhost:8000";
  const { protocol, hostname, port, origin } = window.location;
  return port === "" || port === "80" || port === "443" ? origin : `${protocol}//${hostname}:8000`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  return readAuth()?.token || null;
}

export function isLoggedIn() {
  return !!getToken();
}

export async function api(path: string, opts: { method?: string; body?: any; auth?: boolean; keepalive?: boolean } = {}) {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      keepalive: opts.keepalive,
    });
  } catch (e) {
    throw new ApiError("連線失敗，請確認網路或伺服器狀態", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    try {
      localStorage.removeItem("cloud-rpg-auth");
      window.dispatchEvent(new Event("cloud-rpg-auth-change"));
    } catch {}
  }
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : Array.isArray(data?.detail) ? data.detail[0]?.msg : null;
    throw new ApiError(detail || `伺服器錯誤 (${res.status})`, res.status);
  }
  return data;
}

/* ───────────── WebSocket：聊天與團隊 Boss 即時更新（斷線自動重連） ───────────── */

type Listener = (msg: any) => void;
const listeners = new Set<Listener>();
let ws: WebSocket | null = null;
let retry = 0;
let pingTimer: any = null;
let connectedToken: string | null = null;

function wsUrl() {
  const base = apiBase().replace(/^http/, "ws");
  const token = getToken();
  return `${base}/api/ws${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

function connect() {
  if (typeof window === "undefined") return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  connectedToken = getToken();
  try {
    ws = new WebSocket(wsUrl());
  } catch {
    return scheduleReconnect();
  }
  ws.onopen = () => {
    retry = 0;
    clearInterval(pingTimer);
    pingTimer = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send("ping"), 25000);
  };
  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    listeners.forEach((fn) => fn(msg));
  };
  ws.onclose = () => {
    clearInterval(pingTimer);
    ws = null;
    if (listeners.size) scheduleReconnect();
  };
}

function scheduleReconnect() {
  retry = Math.min(retry + 1, 6);
  setTimeout(() => listeners.size && connect(), 1000 * 2 ** retry);
}

/** 訂閱即時訊息；回傳取消訂閱函式。登入狀態改變時會自動用新 token 重連 */
export function subscribeLive(fn: Listener) {
  listeners.add(fn);
  if (ws && connectedToken !== getToken()) ws.close();
  connect();
  return () => {
    listeners.delete(fn);
    if (!listeners.size && ws) ws.close();
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("cloud-rpg-auth-change", () => {
    if (ws) ws.close();
  });
}
