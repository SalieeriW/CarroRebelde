export function createWsClient(url) {
  const ws = new WebSocket(url);
  const handlers = new Map(); // type -> [fn]

  const api = {
    send(obj) {
      const payload = JSON.stringify(obj);
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
      else ws.addEventListener("open", () => ws.send(payload), { once: true });
    },
    on(type, fn) {
      const arr = handlers.get(type) || [];
      arr.push(fn);
      handlers.set(type, arr);
    },
    close() {
      ws.close();
    },
  };

  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const arr = handlers.get(msg.type) || [];
    for (const fn of arr) fn(msg);
  });

  return api;
}
