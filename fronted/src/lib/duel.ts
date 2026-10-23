// @ts-nocheck
/* 線上即時對戰的 WebSocket 連線（/api/ws/duel），協定見 backend/app/duel.py。
 * 房主（host）跑完整模擬並送畫面狀態（st），對手（guest）送按鍵（in）並畫收到的狀態。 */
import { apiBase, getToken } from "./api";

export class DuelClient {
  ws: WebSocket | null = null;
  private handlers = new Set<(m: any) => void>();
  private ping: any = null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = getToken();
      if (!token) return reject(new Error("請先登入才能線上對戰"));
      const url = `${apiBase().replace(/^http/, "ws")}/api/ws/duel?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 25000);
        resolve();
      };
      ws.onerror = () => reject(new Error("連不上對戰伺服器"));
      ws.onclose = () => {
        clearInterval(this.ping);
        this.emit({ t: "closed" });
      };
      ws.onmessage = (ev) => {
        let m;
        try {
          m = JSON.parse(ev.data);
        } catch {
          return;
        }
        this.emit(m);
      };
    });
  }

  private emit(m: any) {
    this.handlers.forEach((fn) => fn(m));
  }

  on(fn: (m: any) => void) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  send(obj: any) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  close() {
    clearInterval(this.ping);
    this.handlers.clear();
    this.ws?.close();
    this.ws = null;
  }
}
