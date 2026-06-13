FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY scripts/entrypoint.sh /entrypoint.sh
COPY scripts/start-https.mjs ./scripts/start-https.mjs

# Strip Windows CRLF so the script runs in Linux containers
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV HOST=0.0.0.0
ENV PORT=4321
ENV DATA_DIR=/data
ENV NODE_ENV=production

EXPOSE 4321

VOLUME ["/data"]

ENTRYPOINT ["sh", "/entrypoint.sh"]
