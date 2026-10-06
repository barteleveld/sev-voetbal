// Local-only cold-cache preview. The real app remains on port 4173.
// Hero images: 150 ms latency + 500 kbit/s, with cache disabled.
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.SLOW_PREVIEW_PORT || 4176);
http.createServer(async (request, response) => {
  const started = Date.now();
  const target = new URL("http://127.0.0.1:4173");
  const path = new URL(request.url, "http://127.0.0.1");
  target.pathname = path.pathname;
  target.search = path.search;
  const hero = /^\/assets\/optimized\/hero-[a-z-]+\.webp$/.test(target.pathname);
  try {
    const upstream = await fetch(target);
    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (hero) {
      await delay(150);
      const chunkSize = 6250;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        await delay(100);
        if (response.destroyed) return;
        response.write(bytes.subarray(offset, offset + chunkSize));
      }
      console.log(`${target.pathname}: ${bytes.length} bytes in ${Date.now() - started} ms`);
    } else response.write(bytes);
    response.end();
  } catch {
    if (!response.headersSent) response.writeHead(502);
    response.end("Start eerst de lokale SEV-server op poort 4173.");
  }
}).listen(port, "127.0.0.1", () => console.log(`Cold-cache mobile preview: http://127.0.0.1:${port}`));
