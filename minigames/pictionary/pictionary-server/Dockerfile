FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY pictionary-server/package*.json ./
RUN npm install

# Copy TypeScript config
COPY pictionary-server/tsconfig.json ./

# Copy source and resources
COPY pictionary-server/src ./src
COPY pictionary-server/resources ./resources

ENV PORT=2234
EXPOSE 2234

CMD ["npm", "run", "dev"]