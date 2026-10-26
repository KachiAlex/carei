#!/bin/sh
set -e

echo ">>> Installing Node.js..."
brew install node

cd "$CI_WORKSPACE"

echo ">>> Installing npm dependencies..."
npm ci

echo ">>> Building web assets..."
npm run build

echo ">>> Syncing Capacitor iOS (runs pod install)..."
npx cap sync ios
