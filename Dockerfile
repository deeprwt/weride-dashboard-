# =============================================================================
# uride-dashboard — Next.js admin/ops portal, self-contained (npm workspaces).
#   docker build -t uride-dashboard ./dashboard     (from repo root)
# =============================================================================

FROM node:22-alpine AS build
WORKDIR /app

# Manifests + vendored package manifests first for cached installs.
COPY package.json .npmrc ./
COPY packages ./packages
RUN npm install --include=dev

# App sources, then build vendored libs (tsup) and the Next app.
COPY . .
RUN npm run build:standalone

# ---- runtime ----
FROM build AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/ >/dev/null 2>&1 || exit 1
CMD ["npm", "start"]
