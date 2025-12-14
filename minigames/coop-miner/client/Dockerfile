FROM node:20-alpine
WORKDIR /app

COPY client/package*.json ./
RUN npm install

COPY client ./
COPY shared ./shared
COPY shared /shared

ENV PORT=7084
EXPOSE 7084

CMD ["sh", "-c", "npm run dev -- --host --port ${PORT:-4184}"]
