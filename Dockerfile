# Production static hosting for Railway: Node listens on 0.0.0.0:$PORT (see serve-static.mjs).
FROM node:20-alpine AS builder
# Bump when Railway keeps serving an old nginx image from cache (see deploy logs for nginx vs [static]).
ARG RAILWAY_DOCKERFILE_REVISION=2
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY serve-static.mjs ./
ENV NODE_ENV=production
# Railway injects PORT at runtime — do not pin PORT in Railway UI for the frontend service.
EXPOSE 8080
CMD ["node", "serve-static.mjs"]
