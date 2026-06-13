FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY src ./src

ENV HOST=0.0.0.0
ENV PORT=8443
ENV DATA_DIR=/data

VOLUME /data
EXPOSE 8443

CMD ["node", "src/server.js"]
