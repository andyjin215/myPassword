# MyPassword

A modern, self-hosted password manager built with Electron, React, and TypeScript. All data is encrypted locally on your device using AES-256-GCM with PBKDF2 key derivation.

## Features

- **Local-first encryption** — AES-256-GCM with 600K PBKDF2 iterations, DEK/KEK envelope architecture
- **Chrome extension** — Autofill credentials in the browser with HMAC-authenticated RPC
- **Password generator** — Cryptographically secure, configurable charset and length
- **Auto-lock** — Configurable idle timer, locks on system suspend/screen lock
- **Clipboard security** — Automatically clears copied passwords after 30 seconds
- **Soft delete & trash** — Recover deleted items before permanent removal

## Architecture

```
┌─────────────────┐     IPC      ┌──────────────────┐
│  React Renderer │◄────────────►│  Electron Main    │
│  (Tailwind UI)  │              │  (RPC Server)     │
└─────────────────┘              │  127.0.0.1:27432  │
                                 └────────┬──────────┘
                                          │ HTTP + HMAC
                                 ┌────────▼──────────┐
                                 │  Chrome Extension  │
                                 │  (Manifest V3)     │
                                 └───────────────────┘
```

## Tech Stack

- **Desktop**: Electron 33 + React 18 + TypeScript + Tailwind CSS
- **Storage**: SQLite (better-sqlite3) with WAL mode
- **Crypto**: Node.js `crypto` (AES-256-GCM, PBKDF2-SHA256)
- **Extension**: Chrome Manifest V3, Web Crypto API for HMAC-SHA256
- **Build**: Vite + tsc

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install & Run

```bash
git clone <repo-url>
cd mypassword
npm install
npm run dev
```

The desktop app opens automatically and the RPC server starts on `127.0.0.1:27432`.

### Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/chrome` directory
4. Click the extension icon and follow the pairing flow

## Security

| Component | Detail |
|-----------|--------|
| Key derivation | PBKDF2-HMAC-SHA256, 600,000 iterations |
| Data encryption | AES-256-GCM (128-bit IV, 128-bit auth tag) |
| Master password | Minimum 6 characters (numeric PIN supported) |
| Extension auth | HMAC-SHA256 request signing with 30s replay window |
| Pairing | Polling-based approval, seed not activated until user confirms |
| Rate limiting | /pair: 5/min, /vault/unlock: 10/min |
| Request body limit | 1 MB |
| CORS | Restricted to localhost origins |

## Project Structure

```
mypassword/
├── src/
│   ├── main/          # Electron main process + RPC server
│   ├── core/          # Crypto (AES, PBKDF2, password gen) + Database
│   ├── renderer/      # React UI components
│   └── preload/       # Electron preload (context bridge)
├── extension/
│   └── chrome/        # Chrome extension (MV3 service worker + content script)
├── test/              # Self-test scripts
└── package.json
```

## License

MIT
