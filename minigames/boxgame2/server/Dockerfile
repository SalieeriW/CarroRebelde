FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm i --omit=dev
COPY src ./src
EXPOSE 8080
CMD ["npm","start"]
