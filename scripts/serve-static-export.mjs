import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { siteBasePath } from "../src/lib/site-path.ts";

const output = resolve("out");
const types = {
  ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".gif": "image/gif", ".png": "image/png", ".webp": "image/webp",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff2": "font/woff2",
  ".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt; charset=utf-8",
  ".pdf": "application/pdf",
};

async function fileInfo(path) {
  return stat(path).catch((error) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
  });
}

const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === siteBasePath) {
      response.writeHead(308, { Location: siteBasePath + "/" + url.search }).end();
      return;
    }
    let file;
    if (url.pathname.startsWith(siteBasePath + "/")) {
      const relativePath = decodeURIComponent(url.pathname.slice(siteBasePath.length + 1));
      if (relativePath.split("/").every((segment) => segment !== ".." && !/[\\:\u0000]/.test(segment))) {
        const candidate = join(output, relativePath);
        const info = await fileInfo(candidate);
        if (info?.isDirectory() && !url.pathname.endsWith("/") && (await fileInfo(join(candidate, "index.html")))?.isFile()) {
          response.writeHead(308, { Location: url.pathname + "/" + url.search }).end();
          return;
        }
        file = info?.isDirectory() ? join(candidate, "index.html") : candidate;
      }
    }
    const exists = file && (await fileInfo(file))?.isFile();
    const body = exists ? file : join(output, "404.html");
    response.writeHead(exists ? 200 : 404, { "Content-Type": types[extname(body)] ?? "application/octet-stream" });
    if (request.method === "HEAD") response.end();
    else createReadStream(body).on("error", () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(400).end();
  }
});

await stat(join(output, "404.html"));
const port = Number(process.env.PORT ?? 3000);
server.listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}${siteBasePath}/`));
