FROM node:22-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy application files
COPY server.js ./
COPY dist/api/ ./dist/api/
COPY db-local.js ./dist/api/db.js
COPY db-local.js ./dist/db.js

# Expose the API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
