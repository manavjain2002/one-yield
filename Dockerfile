FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint-frontend.sh /docker-entrypoint-frontend.sh
RUN chmod +x /docker-entrypoint-frontend.sh
# Railway sets PORT; nginx must listen on that port (default 8080 for local/docker).
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint-frontend.sh"]
