FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY wordle-client/package*.json ./
RUN npm install

# Copy source
COPY wordle-client ./

ENV PORT=1000
EXPOSE 1000

# Run Vite dev server
CMD ["sh", "-c", "npm run dev -- --host --port ${PORT:-1000}"]