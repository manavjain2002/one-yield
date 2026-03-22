#!/bin/sh
set -e
# Railway (and other PaaS) set PORT; nginx must listen on that port or the proxy returns 502.
LISTEN_PORT="${PORT:-8080}"
export LISTEN_PORT
sed -i "s|__LISTEN_PORT__|${LISTEN_PORT}|g" /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
