# syntax=docker/dockerfile:1.6

# ─── Stage 1: install production dependencies on a slim image ──────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Build deps + Python (for any node-gyp targets) and curl for yt-dlp download
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# Pre-download yt-dlp once so the runtime image doesn't need network for it
RUN curl -fsSL -o /app/yt-dlp \
        https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod a+rx /app/yt-dlp


# ─── Stage 2: minimal runtime ──────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Only ffmpeg + python3 are needed at runtime
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        ffmpeg \
        python3 \
        tini \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy installed deps and yt-dlp from build stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/yt-dlp ./yt-dlp

# App source last so node_modules layer can be cached across rebuilds
COPY . .

RUN mkdir -p /app/session /app/downloads /app/sessions

ENV NODE_ENV=production \
    PORT=5000 \
    NODE_OPTIONS=--no-warnings

EXPOSE 5000

# Container healthcheck hits the unauthenticated /bot-api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/bot-api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start"]
