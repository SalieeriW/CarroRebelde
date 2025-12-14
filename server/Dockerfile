FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY server/package*.json ./
COPY server/tsconfig.json ./tsconfig.json
RUN npm ci

# Copy source
COPY server/src ./src
COPY server/data ./data

ENV PORT=2567
EXPOSE 2567

CMD ["npm", "run", "dev"]

