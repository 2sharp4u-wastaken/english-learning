#!/usr/bin/env python3
"""OPTIONAL dev-authoring server. The app does NOT require it.

As of Slice 4.3 the app is fully Python-free: run it with `npm run dev` (Vite,
port 3002) alone. This script is kept only as an optional maintainer tool:
  - /api/enrich-nikud : Dicta Nakdan CORS proxy for regenerating the static
                        data/nikud-map.json when new *base* vocabulary is added
  - /api/write-text / /api/write-image / /api/fetch-image : bake authored
                        content into repo source (the in-app tools persist to
                        the browser via the customContent bridge instead)
  - static serving with no-cache + optional HTTPS (server.crt/server.key) for
    testing the legacy build over a LAN IP

Nothing the running app does depends on these endpoints.

Extra endpoints (only served from this machine's own IPs for safety):
  POST /api/write-text   { path, content }           – write a UTF-8 text file
  POST /api/write-image  { path, base64 }            – write a binary image file
  GET  /api/ping                                     – health check
"""
import base64
import http.server
import ipaddress
import json
import mimetypes
import os
import socket
import socketserver
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

PORT      = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
BASE_DIR  = Path(__file__).parent.resolve()   # project root

CERT_FILE = BASE_DIR / 'server.crt'
KEY_FILE  = BASE_DIR / 'server.key'
USE_HTTPS = CERT_FILE.exists() and KEY_FILE.exists()


def _local_ips() -> set:
    """Return all IP addresses that belong to this machine."""
    ips = {'127.0.0.1', '::1', 'localhost'}
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None):
            ips.add(info[4][0])
    except Exception:
        pass
    return ips

_LOCAL_IPS = _local_ips()


def _safe_path(rel_path: str) -> Optional[Path]:
    """Return an absolute path only if it stays inside BASE_DIR."""
    target = (BASE_DIR / rel_path).resolve()
    try:
        target.relative_to(BASE_DIR)   # raises ValueError if outside
        return target
    except ValueError:
        return None


def _url_host_is_public(url: str) -> bool:
    """SSRF guard for _fetch_image: True only if the URL's host resolves entirely
    to public (globally-routable) addresses. Rejects loopback / private /
    link-local (incl. the 169.254.169.254 cloud metadata endpoint) / reserved
    IPs. Fails closed on any resolution error."""
    try:
        host = urllib.parse.urlparse(url).hostname
        if not host:
            return False
        infos = socket.getaddrinfo(host, None)
        if not infos:
            return False
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if (ip.is_private or ip.is_loopback or ip.is_link_local
                    or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
                return False
        return True
    except Exception:
        return False


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):

    # ── API routes ─────────────────────────────────────────────────

    def do_POST(self):
        # Only allow write calls from this machine's own IPs
        if self.client_address[0] not in _LOCAL_IPS:
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
        elif self.path == '/api/enrich-nikud':
            self._enrich_nikud(data)
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
        """Fetch an image from a remote URL and save it to a local path.

        SSRF note: this fetches a caller-supplied URL. The server binds to this
        machine's own IPs only (see the guard in do_POST/_client_allowed), so the
        caller is already local/maintainer — but as defence-in-depth we still
        reject URLs that resolve to a private / loopback / link-local / reserved
        address, so a local page can't use this to reach the cloud metadata
        endpoint (169.254.169.254) or an internal host. If this endpoint is ever
        exposed beyond localhost, tighten this to a positive host allowlist.
        """
        url  = data.get('url', '')
        rel  = data.get('path', '')   # desired local path, e.g. img/icons/body/neck.png
        dest = _safe_path(rel)
        if dest is None:
            self._reply(400, {'error': 'path escapes project root'})
            return
        if not url.startswith(('http://', 'https://')):
            self._reply(400, {'error': 'invalid URL'})
            return
        if not _url_host_is_public(url):
            self._reply(400, {'error': 'URL resolves to a non-public address'})
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

    def _enrich_nikud(self, data):
        """Proxy to the Nakdan nikud API — bypasses browser CORS restrictions."""
        payload = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(
            'https://nakdan-u1-0.loadbalancer.dicta.org.il/api',
            data=payload,
            headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read())
            self._reply(200, result)
        except Exception as e:
            self._reply(502, {'error': f'nakdan proxy failed: {e}'})

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
        if getattr(self, 'path', '').startswith('/api/write'):
            print(f'[write] {self.path} – {args}')


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    if USE_HTTPS:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT_FILE, KEY_FILE)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        scheme = 'https'
    else:
        scheme = 'http'
    print(f'Dev server running at {scheme}://localhost:{PORT}')
    httpd.serve_forever()
