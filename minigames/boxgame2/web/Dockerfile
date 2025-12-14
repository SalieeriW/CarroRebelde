FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
# Ensure Next.js binary is executable even if upstream permissions are off
RUN npm i && \
    chmod +x node_modules/next/dist/bin/next && \
    mkdir -p node_modules/.bin && \
    ln -sf ../next/dist/bin/next node_modules/.bin/next

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Pass environment variables during build for Next.js
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_BLINDRALLY_SERVER_URL
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_BLINDRALLY_SERVER_URL=${NEXT_PUBLIC_BLINDRALLY_SERVER_URL}
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node","server.js"]
