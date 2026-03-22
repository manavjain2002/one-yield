/**
 * Minimal static server for Railway: always binds 0.0.0.0 and PORT (no nginx/serve quirks).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '8080', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function safeJoin(base, requestPath) {
  const rel = path.normalize(decodeURIComponent(requestPath.split('?')[0])).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(base, rel);
  if (!full.startsWith(base)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  }

  const filePath = safeJoin(dist, urlPath);

  const sendFile = (fp) => {
    const ext = path.extname(fp);
    const type = MIME[ext] || 'application/octet-stream';
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) {
        sendSpa();
        return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(fp).pipe(res);
    });
  };

  const sendSpa = () => {
    const indexPath = path.join(dist, 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server misconfiguration: dist/index.html missing');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  };

  if (!filePath) {
    sendSpa();
    return;
  }

  const looksLikeAsset = /\.[a-zA-Z0-9]{1,8}$/.test(urlPath);

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      sendFile(filePath);
      return;
    }
    if (!err && st.isDirectory()) {
      const idx = path.join(filePath, 'index.html');
      fs.stat(idx, (e2, s2) => {
        if (!e2 && s2.isFile()) sendFile(idx);
        else if (looksLikeAsset) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        } else sendSpa();
      });
      return;
    }
    if (looksLikeAsset) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    sendSpa();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[static] listening on http://0.0.0.0:${PORT} (dist=${dist})`);
});
