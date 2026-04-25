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
or any external uptime monitor.

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
