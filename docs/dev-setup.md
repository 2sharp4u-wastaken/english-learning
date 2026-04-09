# Dev Setup

## Starting the servers

Three sibling projects share the same codebase pattern, each on a fixed port:

| Port | Directory | Description |
|------|-----------|-------------|
| 3000 | `english-learning` | v1 / original |
| 3001 | `english-learning-redesign` | v2 redesign |
| 3002 | `english-learning-ui-overhaul` | active ui-overhaul branch |

Launch all three at once:

```bash
~/Documents/projects/start-servers.sh
```

Or individually:

```bash
python3 server.py        # port 3000 (default)
python3 server.py 3001
python3 server.py 3002
```

## HTTPS (required for microphone)

`getUserMedia` (microphone access) is blocked by browsers on plain HTTP from LAN IP addresses. The server auto-detects `server.crt` / `server.key` in the project root and serves HTTPS when both exist.

Access via `https://192.168.1.111:<port>` — not `http://`.

### Generating certificates (mkcert)

`mkcert` is installed via Homebrew. The local CA was already installed with `mkcert -install`. To regenerate certs (e.g. after expiry or for a new machine):

```bash
cd ~/Documents/projects/english-learning-ui-overhaul
mkcert 192.168.1.111 localhost 127.0.0.1
mv 192.168.1.111+2.pem server.crt
mv 192.168.1.111+2-key.pem server.key
# Copy to sibling projects:
cp server.crt server.key ../english-learning/
cp server.crt server.key ../english-learning-redesign/
```

On a new device that needs to trust the certs, install the mkcert CA from the Mac:

```
~/.local/share/mkcert/rootCA.pem   # macOS path
```

## Write API (settings image uploads)

`/api/write-image` and `/api/write-text` are restricted to requests coming from the server machine's own IPs. `server.py` resolves all local IPs at startup via `socket.getaddrinfo`, so accessing via the LAN IP (`192.168.1.111`) works — not just `127.0.0.1`.

## Known limitations (before sharing)

These are architectural constraints that are fine for local family use but become problems if the project is shared more broadly.

### Data lives in the browser (localStorage)

All user accounts, progress, coins, and settings are stored in `localStorage` — scoped to a single browser origin on a single device.

Consequences:
- **Per-device** — a child's progress on a tablet is invisible from a phone or laptop. No sync.
- **Origin-fragile** — switching from `http://` to `https://`, changing the port, or changing the IP creates a blank slate. (We hit this when enabling HTTPS.)
- **Clearable** — private/incognito mode, "clear site data", or browser storage pressure silently wipes everything.
- **No parent dashboard** — a parent can't check progress without being on the same device the child used.

Migration path: replace `localStorage` reads/writes with `fetch()` calls to server-side endpoints backed by SQLite. The `server.py` pattern already exists for this.

### Server must be running and reachable

The app requires `python3 server.py` to be running on the Mac. If the Mac sleeps, is on a different network, or restarts, all connected devices lose access.

Consequences:
- Not usable away from home WiFi.
- Not usable if the Mac is closed.
- No fallback / offline mode.

### LAN-only access

The server binds to `0.0.0.0` (all interfaces) but is only reachable on the local network. There is no external access, no domain name, and no SSL certificate from a real CA.

### Certificates require per-device setup

The mkcert CA must be trusted on every device that accesses the app. On iOS this requires manually installing a profile and enabling it in Settings. Certificates also expire (currently 1 year from generation).

### Custom images stored on disk, no backup

Images uploaded via the settings page are written to `img/icons/` on the Mac by `server.py`. They are not backed up anywhere. If the project directory is deleted or the Mac fails, they are gone.

### No real authentication

Passwords are hashed client-side and stored in `localStorage['authUsers']`. There is no server-side session or token. Anyone with access to the same browser can read the storage directly.

### Cache busting is manual

CSS and JS files use `?t=<timestamp>` query strings. These must be updated manually when files change, or browsers may serve stale versions to other devices.

## Fixed UI positioning rule

The `.top-header` is `position: fixed` and `60px` tall. Any fixed-position UI element that should appear below it (e.g. `.feedback` overlays) must use `top: 70px` or more (60px header + 10px gap).
