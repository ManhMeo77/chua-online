// Kết nối WebSocket tới server, tự nối lại khi rớt mạng.

export function getClientId() {
  try {
    let cid = localStorage.getItem('dichua.cid');
    if (!cid) {
      cid = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem('dichua.cid', cid);
    }
    return cid;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

/** Lưu mã hồ sơ mới (sau khi đăng nhập). Truyền null để xóa (đăng xuất). */
export function setClientId(cid) {
  try {
    if (cid) localStorage.setItem('dichua.cid', cid);
    else localStorage.removeItem('dichua.cid');
  } catch {}
}

export class Net {
  /**
   * @param {{ hello: () => object, onMsg: (m:any)=>void, onStatus: (ok:boolean)=>void }} opts
   */
  constructor({ hello, onMsg, onStatus }) {
    this.hello = hello;
    this.onMsg = onMsg;
    this.onStatus = onStatus;
    this.ws = null;
    this.retry = 1000;
    this.myId = 0;
    this.open();
  }

  open() {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 1000;
      this.onStatus(true);
      ws.send(JSON.stringify({ t: 'hello', ...this.hello() }));
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') this.myId = m.id;
      this.onMsg(m);
    };
    ws.onclose = () => {
      this.onStatus(false);
      setTimeout(() => this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 15000);
    };
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
