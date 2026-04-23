# Build: TypeScript + Vite client → dist/
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ libsecret-dev
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci && (cd client && npm ci)
COPY . .
RUN npm run build

# Runtime: production deps only (native modules compiled for this image)
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache ca-certificates python3 make g++ libsecret-dev \
  && update-ca-certificates
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3000
# After update-ca-certificates, use OpenSSL default CA path for TLS (not --use-system-ca: disallowed in NODE_OPTIONS)
ENV NODE_OPTIONS=--use-openssl-ca
ENV NODE_ENV=production
ENV USE_ENV_CREDENTIALS=true
CMD ["node", "dist/src/cli.js"]
