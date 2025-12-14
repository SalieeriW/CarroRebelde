FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY pictionary-client/package*.json ./
RUN npm install

# Copy source
COPY pictionary-client ./

ENV PORT=2000
EXPOSE 2000

# Run Vite dev server
CMD ["sh", "-c", "npm run dev -- --host --port ${PORT:-2000}"]