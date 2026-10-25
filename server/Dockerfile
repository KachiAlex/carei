# ─── Build stage: compile TypeScript API handlers ───
FROM node:22-slim AS build
WORKDIR /repo
COPY server/package.json server/package-lock.json* server/
RUN cd server && npm install
COPY server/tsconfig.json server/
COPY api/ api/
COPY server/server.js server/
COPY server/db-local.js server/db-local.js
RUN ln -s /repo/server/node_modules /repo/node_modules
RUN cd server && npx tsc -p tsconfig.json

# ─── Runtime stage ───
FROM node:22-slim
WORKDIR /app

# Copy package files and install dependencies
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# Copy application files
COPY server/server.js ./
COPY --from=build /repo/server/dist/api/ ./dist/api/
COPY server/db-local.js ./dist/api/db.js
COPY server/db-local.js ./dist/db.js

# Expose the API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
