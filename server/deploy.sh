#!/bin/bash
set -e

echo "========================================="
echo "  CAREi API Server - VPS Deployment"
echo "========================================="

# ─── Configuration ───
APP_DIR="/var/www/carei"
LOG_DIR="/var/log/carei"
NODE_VERSION="22.x"

echo ""
echo ">>> Updating system packages..."
apt-get update -y
apt-get upgrade -y

echo ""
echo ">>> Installing prerequisites..."
apt-get install -y curl git nginx ufw

# ─── Node.js ───
if ! command -v node &> /dev/null; then
  echo ""
  echo ">>> Installing Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION | bash -
  apt-get install -y nodejs
fi
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# ─── PM2 ───
if ! command -v pm2 &> /dev/null; then
  echo ""
  echo ">>> Installing PM2..."
  npm install -g pm2
fi
echo "PM2 version: $(pm2 --version)"

# ─── Create directories ───
echo ""
echo ">>> Creating directories..."
mkdir -p $APP_DIR/server
mkdir -p $APP_DIR/api
mkdir -p $LOG_DIR

# ─── Copy application files ───
echo ""
echo ">>> Copying server files..."
cp -r server/* $APP_DIR/server/
cp -r api/* $APP_DIR/api/

# ─── Install server dependencies ───
echo ""
echo ">>> Installing server dependencies..."
cd $APP_DIR/server
npm install --production

# ─── Set up environment variables ───
echo ""
echo ">>> Setting up environment variables..."
if [ ! -f $APP_DIR/server/.env ]; then
  cat > $APP_DIR/server/.env << 'ENVEOF'
NODE_ENV=production
PORT=3001
# Database URL - UPDATE THIS with your Neon or local PostgreSQL connection string
DATABASE_URL=
# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-west-2
AWS_S3_BUCKET=
# Anthropic API key (for AI features)
ANTHROPIC_API_KEY=
# JWT secret
JWT_SECRET=
ENVEOF
  echo "Created .env file at $APP_DIR/server/.env"
  echo "IMPORTANT: Edit this file to add your DATABASE_URL and other secrets!"
else
  echo ".env already exists, skipping..."
fi

# ─── Configure Nginx ───
echo ""
echo ">>> Configuring Nginx..."
cp $APP_DIR/server/nginx-carei-api.conf /etc/nginx/sites-available/carei-api
ln -sf /etc/nginx/sites-available/carei-api /etc/nginx/sites-enabled/carei-api

# Remove default nginx site
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t
systemctl reload nginx

# ─── Configure firewall ───
echo ""
echo ">>> Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ─── Start with PM2 ───
echo ""
echo ">>> Starting application with PM2..."
cd $APP_DIR/server
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root

# ─── SSL with Certbot ───
echo ""
echo ">>> Setting up SSL with Let's Encrypt..."
if ! command -v certbot &> /dev/null; then
  apt-get install -y certbot python3-certbot-nginx
fi
echo ""
echo "To enable SSL, run:"
echo "  certbot --nginx -d api.careiapp.com"
echo ""
echo "Make sure your DNS A record for api.careiapp.com points to this server's IP (67.211.210.8)"
echo ""

# ─── Done ───
echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Edit $APP_DIR/server/.env to add your DATABASE_URL and secrets"
echo "  2. Restart the app: pm2 restart carei-api"
echo "  3. Set up DNS: A record for api.careiapp.com -> 67.211.210.8"
echo "  4. Enable SSL: certbot --nginx -d api.careiapp.com"
echo "  5. Test: curl http://localhost:3001/health"
echo ""
