#!/bin/bash
# Fix Cloudflare 520 by adding HTTPS support for api.careiapp.com
# Uses Cloudflare Origin Certificate approach with existing sslip.io cert as fallback

NGINX_CONF="/etc/nginx/sites-available/carei-api"

cat > "$NGINX_CONF" << 'NGINXEOF'
server {
    listen 80;
    server_name api.careiapp.com 67.211.210.8;

    # Redirect HTTP to HTTPS for api.careiapp.com (Cloudflare handles SSL)
    if ($host = api.careiapp.com) {
        return 301 https://$host$request_uri;
    }

    # Allow direct HTTP access via IP (for health checks, internal)
    location / {
        proxy_pass http://127.0.0.1:3012;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /health {
        proxy_pass http://127.0.0.1:3012;
        proxy_set_header Host $host;
        access_log off;
    }
}

server {
    listen 443 ssl;
    server_name api.careiapp.com;

    # Use existing sslip.io cert as fallback (Cloudflare Full mode accepts self-signed/origin certs)
    ssl_certificate /etc/letsencrypt/live/67-211-210-8.sslip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/67-211-210-8.sslip.io/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3012;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /health {
        proxy_pass http://127.0.0.1:3012;
        proxy_set_header Host $host;
        access_log off;
    }
}
NGINXEOF

echo "=== Testing nginx config ==="
nginx -t 2>&1

echo "=== Reloading nginx ==="
systemctl reload nginx

echo "=== Testing HTTPS ==="
curl -sk https://127.0.0.1/health -H "Host: api.careiapp.com" 2>&1
echo ""
echo "=== Testing HTTP ==="
curl -s http://127.0.0.1:3012/health 2>&1
