# 🚀 CHATHU MD — Pro Edition (v2.3.0)

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Baileys-blue.svg)](https://github.com/WhiskeySockets/Baileys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED.svg)](#-docker)

**CHATHU MD** is a production-grade, multi-session WhatsApp automation platform built on
`@whiskeysockets/baileys`, shipping with a **Cyber-Glass Admin Dashboard**, a rich command
library, a full automation runtime (auto-reply rules, scheduler, broadcast, anti-link /
anti-spam / anti-bad-word protections), and a pro-level security + DevOps stack.

This `Pro Edition` release (v2.3.0) lands all security, runtime, UI and DevOps
hardening in one drop — it is the recommended line for self-hosted or VPS deployments.

---
## 💎 Feature summary

- **🌐 Cyber-Glass Admin Panel** — real-time dashboard with glassmorphism aesthetics
  and 12 pages: Dashboard, Sessions, Users, Groups, Commands, Broadcast, Auto-Reply,
  Scheduler, Files, Logs, Settings, plus the Command Palette overlay.
- **📱 Multi-session manager** — link and run multiple WhatsApp accounts concurrently;
  high-visibility pair-code linking (now works for any E.164 number, not only
  Sri Lankan) or QR scan.
- **🧠 AI auto-reply** — Gemini / OpenRouter / Groq fan-out with persona + language +
  group-mode (mention-only vs. always) configurable live from the bot or dashboard.
- **🛡️ Global protections** — Anti-Link (with bot-admin awareness), Anti-Spam
  (bounded), Anti-Bad-Word (with bot-admin awareness), Mute, Work-Mode (public /
  private / self). All honoured by both the protection loop and the dispatch loop.
- **🌸 89+ commands** across Media (YouTube, Instagram, TikTok, Facebook, etc.),
  Search, Utility, Fun, Group admin, AI, Economy, Anime, NSFW (toggle-gated).
- **📡 Broadcast manager** — send announcements to all groups/users with history
  tracking and audit entries.
- **🧩 Automation runtime** — auto-reply rule engine + scheduler with persistent
  `db.json` storage.
- **🔄 Auto-self-healing** — built-in anti-crash loop that recovers transient
  Baileys/Signal noise in under 10 s, plus structured exit on anything else so a
  process manager can restart cleanly.

---

## 🚀 Quick Start

### 📋 Prerequisites

- **Node.js**: 20.x (18.x may work but is not tested in CI)
- **Git**

### ⚙️ Installation

```bash
git clone https://github.com/chathura4003-blip/CHATHU-V3.git
cd CHATHU-V3
npm ci
npm run syntax-check   # sanity check (expect 49/49 OK)
npm start
```

Open **`http://localhost:5000`** in your browser to reach the dashboard. First-boot
defaults live in `.env.example` — copy to `.env` and adjust.

### 🔑 Hash your admin password (recommended)

```bash
npm run hash-pass -- 'your-strong-password'
# copy the printed $2b$...  hash into ADMIN_PASS in .env
```

Login response reports `passwordHashed: true` when you're on bcrypt — use that to
verify your deployment.

### 🩺 Health check

```bash
curl -s http://localhost:5000/bot-api/health | jq
```

Returns `200` with status/uptime/version when the bot is connected/awaiting link,
`503` otherwise. Suitable for Docker `HEALTHCHECK`, Render / Fly readiness probes,
or any external uptime monitor. Healthcheck v2 also exposes:

| Field | Meaning |
| --- | --- |
| `dbOk` | `true` when the local SQLite-style db is reachable |
| `fleetSessions` | Count of fleet sub-sessions currently `Connected` |
| `aiProvider` | Last selected AI provider (gemini / openrouter / groq / null) |
| `processedTotal` / `commandsTotal` | Lifetime counters mirrored from the dashboard stats |
| `memHeapUsedMB` | V8 heap used (resident is also reported as `memUsedMB`) |

### 📈 Prometheus metrics

```bash
curl -s http://localhost:5000/metrics
```

Exposes the standard text exposition format. Scrape with Prometheus / Grafana
Agent / VictoriaMetrics. Notable series:

- `chathu_connected` — gauge, `1` when the main socket is up
- `chathu_messages_processed_total` / `chathu_commands_run_total`
- `chathu_messages_received_total{session="main|fleet"}`
- `chathu_messages_sent_total` / `chathu_messages_send_retries_total` /
  `chathu_messages_send_failures_total` (from `lib/safe-send.js`)
- `chathu_fleet_sessions_total` / `chathu_fleet_sessions_connected`
- `chathu_plugins_loaded_total` / `chathu_plugins_failed_total`
- Defaults: `chathu_process_uptime_seconds`, `chathu_process_resident_memory_bytes`,
  `chathu_process_heap_used_bytes`

### 📜 Audit log

```bash
curl -sH "Authorization: Bearer $TOKEN" \
     'http://localhost:5000/bot-api/audit?limit=25' | jq
```

---

## 🐳 Docker

```bash
docker build -t chathu-md:v2.3.0 .
docker run -d --name chathu-md \
  --restart unless-stopped \
  -p 5000:5000 \
  -e ADMIN_USER=admin \
  -e ADMIN_PASS='$2b$12$...hash...' \
  -e JWT_SECRET='<long-random>' \
  -v chathu-md-data:/app \
  chathu-md:v2.3.0
```

The image uses a multi-stage build with `tini` for PID 1, drops Python / build
dependencies from the final layer, and includes `HEALTHCHECK --interval=30s` that
polls `/bot-api/health`. A process manager (Docker `--restart`, Fly, Render, pm2 or
systemd) is expected — the bot will intentionally `exit(1)` on a non-noisy uncaught
exception rather than continue in an undefined state.

### 🐙 Compose (with optional Redis)

For a one-command local stack, `docker-compose.yml` boots the bot plus a
`redis:7-alpine` companion (used for the per-user rate-limit cache when
`CHATHU_RATE_LIMIT_BACKEND=redis`):

```bash
cp .env.example .env             # or wire your secrets in some other way
docker compose up -d              # bot + redis
docker compose logs -f bot
docker compose down               # stops both, keeps named volumes
```

Named volumes `chathu-data`, `chathu-downloads`, `chathu-db` and `chathu-redis`
hold all stateful files so re-creating containers does not log you out of WhatsApp
or wipe your scheduled broadcasts.

---

## 🧩 Plugin loader

Drop a `*.js` file into `lib/plugins/` and it will be auto-loaded at boot:

```js
// lib/plugins/my-plugin.js
module.exports = {
  name: 'my-plugin',
  onLoad({ log, metrics }) {
    log.info('hello from my-plugin');
    metrics.counter('myplugin_hits_total', null, 'Plugin hits').inc();
  },
};
```

Failures in any single plugin are isolated — the bot keeps running. See
`lib/plugins/example-ping.js` for a copy-paste starting point (off by default;
set `CHATHU_PLUGIN_PING=1` to enable).

---

## 🔧 Environment variables (cheat sheet)

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `5000` | Dashboard + bot HTTP port |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / `chathura123` | Use `npm run hash-pass` for prod |
| `JWT_SECRET` | random per boot | **Set this in production** so tokens survive restarts |
| `OWNER_NUMBER` | unset | E.164, e.g. `94771234567` — gives owner privileges |
| `LOG_FORMAT` | `pretty` | Set to `json` for log-aggregator-friendly output |
| `LOG_LEVEL` | `info` | One of `trace`, `debug`, `info`, `warn`, `error` |
| `GEMINI_API_KEYS` | unset | Comma-separated; fan-out across all keys |
| `OPENROUTER_API_KEYS` | unset | Same |
| `GROQ_API_KEYS` | unset | Same |
| `CHATHU_RATE_LIMIT_BACKEND` | `memory` | Or `redis` (with `REDIS_URL`) |
| `CHATHU_PLUGIN_PING` | `0` | Set to `1` to enable the bundled example plugin |

---

## 🧪 Development

```bash
npm run syntax-check       # node --check across every .js (49/49)
npm run hash-pass -- '...' # bcrypt(12) a plaintext password
npm start                  # boots bot + dashboard on :5000
```

CI runs `npm ci` + `npm run syntax-check` on every push and every PR. See
`.github/workflows/ci.yml`.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details.

---

**Developed with ❤️ by Chathura**
*Empowering your WhatsApp experience with speed, safety and style.*
