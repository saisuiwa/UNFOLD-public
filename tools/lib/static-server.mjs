// A small static server for the checks and the preview maker: app/ is the site root (like on Cloudflare), and tools/ is reachable at /__tools/
// so test pages can sit in tools/ and still import the app's modules with root-relative paths. Range requests work, so videos can be played.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../../app/', import.meta.url));
const TOOLS = fileURLToPath(new URL('../', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary',
};

function locate(urlPath) {
  let path;
  try { path = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  const [root, rest] = path.startsWith('/__tools/') ? [TOOLS, path.slice('/__tools/'.length)] : [APP, path.slice(1)];
  const file = normalize(join(root, rest));
  if (file !== root.slice(0, -1) && !file.startsWith(root)) return null;           // never leave the two folders
  try {
    const stat = statSync(file);
    if (stat.isDirectory()) return locate(`${path.replace(/\/?$/, '/')}index.html`);
    return { file, size: stat.size };
  } catch { return null; }
}

// Resolves to { url, requests, close() }. requests: every path asked for with its status, so a check can say "this file was missing".
export function startStaticServer({ port = 0 } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    const found = req.method === 'GET' || req.method === 'HEAD' ? locate(req.url) : null;
    if (!found) { requests.push({ path: req.url, status: 404 }); res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    const type = TYPES[extname(found.file)] || 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let status = 200, start = 0, end = found.size - 1;
    if (range && (range[1] || range[2])) {
      start = range[1] ? Number(range[1]) : found.size - Number(range[2]);
      end = range[1] && range[2] ? Math.min(Number(range[2]), found.size - 1) : found.size - 1;
      status = 206;
    }
    requests.push({ path: req.url, status });
    res.writeHead(status, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${found.size}` } : {}) });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(found.file, { start, end }).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, requests, close: () => new Promise(done => server.close(done)) }));
  });
}
