FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY wordle-server/package*.json ./
RUN npm install

# Copy TypeScript config
COPY wordle-server/tsconfig.json ./

# Copy source and resources
COPY wordle-server/src ./src
COPY wordle-server/resources ./resources

ENV PORT=1234
EXPOSE 1234

CMD ["npm", "run", "dev"]