import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST_DIR = resolve(__dirname, '..', process.env.WEB_DIST_DIR ?? 'dist');
const PORT = Number(process.env.PORT ?? process.env.WEB_PORT ?? '4000');
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function contentTypeFor(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0] ?? '/');
  const normalizedBase = normalize(base);
  const target = normalize(join(normalizedBase, decoded));
  if (target !== normalizedBase && !target.startsWith(normalizedBase + sep)) return null;
  return target;
}

function sendFile(res, filePath, cacheControl) {
  res.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': cacheControl,
  });
  createReadStream(filePath).pipe(res);
}

export function createProdServer({ distDir = DEFAULT_DIST_DIR } = {}) {
  const indexFile = join(distDir, 'index.html');
  return createServer((req, res) => {
    const url = req.url ?? '/';

    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    const requestedPath = safeJoin(distDir, url);
    if (!requestedPath) {
      res.writeHead(400);
      res.end();
      return;
    }

    const isAssetRequest = url.startsWith('/assets/');

    if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
      sendFile(res, requestedPath, isAssetRequest ? 'public, max-age=31536000, immutable' : 'no-cache');
      return;
    }

    if (isAssetRequest) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    if (existsSync(indexFile)) {
      sendFile(res, indexFile, 'no-cache');
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });
}

function isEntrypoint() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isEntrypoint()) {
  const server = createProdServer();
  server.listen(PORT, HOST, () => {
    console.log(`Web PlannerFin (produção) servindo ${DEFAULT_DIST_DIR} em ${HOST}:${PORT}.`);
  });
  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
