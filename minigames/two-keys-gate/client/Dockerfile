FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY client/package*.json ./
RUN npm ci

# Copy source and shared assets needed by the UI
COPY client ./
# Keep shared data at both /app/shared and /shared to satisfy relative imports
COPY shared ./shared
COPY shared /shared

ENV PORT=8174
EXPOSE 8174

# Run Vite dev server for interactive testing
CMD ["sh", "-c", "npm run dev -- --host --port ${PORT:-5174}"]
