FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./
COPY server/tsconfig.json ./tsconfig.json
RUN npm ci

COPY server/src ./src
COPY shared ./shared
COPY shared /shared

ENV PORT=7001
EXPOSE 7001

CMD ["npm", "run", "dev"]
