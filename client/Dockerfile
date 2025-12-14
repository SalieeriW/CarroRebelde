FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY client/package*.json ./
RUN npm ci

# Copy source
COPY client ./

ENV PORT=5173
EXPOSE 5173

# Run Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "--port", "5173"]

