FROM node:20-slim AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Piper binary + model are fetched at build time so the image is self-contained
RUN mkdir -p bin \
  && apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/* \
  && curl -L -o /tmp/piper.tar.gz https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz \
  && tar -xzf /tmp/piper.tar.gz -C bin \
  && curl -L -o bin/en_US-lessac-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx \
  && curl -L -o bin/en_US-lessac-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

ENV PIPER_BIN=/app/bin/piper
ENV PIPER_MODEL=/app/bin/en_US-lessac-medium.onnx
ENV DATABASE_PATH=/app/data/app.db

EXPOSE 3000
CMD ["npm", "start"]
