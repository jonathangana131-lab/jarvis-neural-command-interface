export class EventBus {
  #clients = new Set();

  connect(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 1000\n\n');
    res.flushHeaders?.();
    this.#clients.add(res);
    this.emit('connected', { at: new Date().toISOString() });
    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    }, 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      this.#clients.delete(res);
    });
  }

  emit(type, payload = {}) {
    const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.#clients) {
      client.write(message);
    }
  }
}
