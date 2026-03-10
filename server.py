#!/usr/bin/env python3
"""Dev server with no-cache headers and a local-only write API.

Extra endpoints (only served from 127.0.0.1 for safety):
  POST /api/write-text   { path, content }           – write a UTF-8 text file
  POST /api/write-image  { path, base64 }            – write a binary image file
  GET  /api/ping                                     – health check
"""
import base64
import http.server
import json
import mimetypes
import os
import socketserver
import urllib.request
from pathlib import Path
from typing import Optional

PORT      = 3000
BASE_DIR  = Path(__file__).parent.resolve()   # project root


def _safe_path(rel_path: str) -> Optional[Path]:
    """Return an absolute path only if it stays inside BASE_DIR."""
    target = (BASE_DIR / rel_path).resolve()
    try:
        target.relative_to(BASE_DIR)   # raises ValueError if outside
        return target
    except ValueError:
        return None


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):

    # ── API routes ─────────────────────────────────────────────────

    def do_POST(self):
        # Only allow write calls from localhost
        if self.client_address[0] not in ('127.0.0.1', '::1', 'localhost'):
            self._reply(403, {'error': 'forbidden'})
            return

        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self._reply(400, {'error': 'invalid JSON'})
            return

        if self.path == '/api/write-text':
            self._write_text(data)
        elif self.path == '/api/write-image':
            self._write_image(data)
        elif self.path == '/api/fetch-image':
            self._fetch_image(data)
        else:
            self._reply(404, {'error': 'unknown endpoint'})

    def do_GET(self):
        if self.path == '/api/ping':
            self._reply(200, {'ok': True})
            return
        super().do_GET()

    # ── Handlers ────────────────────────────────────────────────────

    def _write_text(self, data):
        rel  = data.get('path', '')
        text = data.get('content', '')
        dest = _safe_path(rel)
        if dest is None:
            self._reply(400, {'error': 'path escapes project root'})
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text, encoding='utf-8')
        self._reply(200, {'ok': True, 'path': str(dest.relative_to(BASE_DIR))})

    def _write_image(self, data):
        rel    = data.get('path', '')
        b64    = data.get('base64', '')
        dest   = _safe_path(rel)
        if dest is None:
            self._reply(400, {'error': 'path escapes project root'})
            return
        # Strip data-URI prefix if present
        if ',' in b64:
            b64 = b64.split(',', 1)[1]
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(base64.b64decode(b64))
        self._reply(200, {'ok': True, 'path': str(dest.relative_to(BASE_DIR))})

    def _fetch_image(self, data):
        """Fetch an image from a remote URL and save it to a local path."""
        url  = data.get('url', '')
        rel  = data.get('path', '')   # desired local path, e.g. img/icons/body/neck.png
        dest = _safe_path(rel)
        if dest is None:
            self._reply(400, {'error': 'path escapes project root'})
            return
        if not url.startswith(('http://', 'https://')):
            self._reply(400, {'error': 'invalid URL'})
            return
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                content_type = resp.headers.get('Content-Type', '')
                image_bytes  = resp.read()
        except Exception as e:
            self._reply(502, {'error': f'fetch failed: {e}'})
            return
        # Derive extension from Content-Type if the caller didn't fix one
        ext_map = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
                   'image/gif': '.gif', 'image/svg+xml': '.svg'}
        mime = content_type.split(';')[0].strip()
        if not dest.suffix and mime in ext_map:
            dest = dest.with_suffix(ext_map[mime])
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(image_bytes)
        saved_rel = str(dest.relative_to(BASE_DIR))
        self._reply(200, {'ok': True, 'path': saved_rel})

    # ── Helpers ─────────────────────────────────────────────────────

    def _reply(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress noisy GET logs; keep API write logs visible
        if self.path.startswith('/api/write'):
            print(f'[write] {self.path} – {args}')


with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Dev server running at http://localhost:{PORT}')
    httpd.serve_forever()
