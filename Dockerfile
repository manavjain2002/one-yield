# Production static hosting for Railway: Node listens on 0.0.0.0:$PORT (see serve-static.mjs).
FROM node:20-alpine AS builder
# Bump when Railway keeps serving an old nginx image from cache (see deploy logs for nginx vs [static]).
ARG RAILWAY_DOCKERFILE_REVISION=13
# Vite bakes these at build time — Railway passes Variables as build args. Use literal URLs in
# Railway UI (e.g. https://one-yield-backend-production.up.railway.app); ${{...}} refs may not resolve.
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build log: empty brackets means Railway did not pass VITE_API_URL into this stage.
RUN echo "VITE_API_URL=[$VITE_API_URL]" && echo "VITE_WS_URL=[$VITE_WS_URL]"
RUN npm run build

FROM node:20-alpine
# Same vars at runtime for /api-config.json (browser fallback when build-time Vite env was empty).
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY serve-static.mjs ./
ENV NODE_ENV=production
# Railway injects PORT at runtime — do not pin PORT in Railway UI for the frontend service.
EXPOSE 8080
CMD ["node", "serve-static.mjs"]
