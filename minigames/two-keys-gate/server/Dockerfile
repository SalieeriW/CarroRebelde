FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY server/package*.json ./
COPY server/tsconfig.json ./tsconfig.json
RUN npm ci

# Copy source and shared assets
COPY server/src ./src
# Keep shared data at both /app/shared and /shared to satisfy relative imports
COPY shared ./shared
COPY shared /shared

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "dev"]
