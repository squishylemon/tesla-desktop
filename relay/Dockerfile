FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY scripts/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV HOST=0.0.0.0
ENV PORT=8443
ENV DATA_DIR=/data

VOLUME /data
EXPOSE 8443

ENTRYPOINT ["sh", "/entrypoint.sh"]
