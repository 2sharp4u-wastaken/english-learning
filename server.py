#!/usr/bin/env python3
"""Dev server with no-cache headers so browser always fetches fresh JS/CSS files."""
import http.server
import socketserver

PORT = 3000

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress noisy request logs; comment out to re-enable
        pass

with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Dev server running at http://localhost:{PORT}")
    httpd.serve_forever()
