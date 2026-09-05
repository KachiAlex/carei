#!/bin/bash
set -e

echo ">>> Installing pg package..."
cd /var/www/carei/server
npm install pg 2>&1

echo ""
echo ">>> Checking file locations..."
ls -la /var/www/carei/server/api/db.js
ls -la /var/www/carei/server/server.js

echo ""
echo ">>> Patching db.js to use local pg instead of Neon..."

cat > /var/www/carei/server/patch-db.cjs << 'PATCHEOF'
const fs = require('fs')
const dbPath = '/var/www/carei/server/api/db.js'
let content = fs.readFileSync(dbPath, 'utf8')

console.log('Original db.js first 300 chars:', content.substring(0, 300))

// Replace the import line - handle various compiled formats
const newImport = `import pg from 'pg'
const { Pool } = pg
let _pool = null
function getPool() {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL not set')
    _pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })
  }
  return _pool
}
function makeSql() {
  const pool = getPool()
  function sql(strings, ...values) {
    let query = strings[0]
    const params = []
    for (let i = 0; i < values.length; i++) {
      params.push(values[i])
      query += '$' + (i + 1) + strings[i + 1]
    }
    return pool.query(query, params).then(res => res.rows)
  }
  sql.query = async (text, values) => {
    const res = await pool.query(text, values)
    return res.rows
  }
  return sql
}
const neon = makeSql
const Client = pg.Client`

if (content.includes("@neondatabase/serverless")) {
  content = content.replace(
    /import\s*\{[^}]*\}\s*from\s*['"]@neondatabase\/serverless['"]/,
    newImport
  )
  console.log('Replaced Neon import with pg')
} else {
  console.log('WARNING: Neon import not found!')
}

// Replace getSql
content = content.replace(
  /export function getSql\(\)\s*\{[^}]*\}/,
  `export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set');
  return neon(connectionString);
}`
)

// Replace getClient
content = content.replace(
  /export function getClient\(\)\s*\{[^}]*\}/,
  `export function getClient() {
  return getPool();
}`
)

fs.writeFileSync(dbPath, content)
console.log('Patched db.js successfully')
PATCHEOF

node /var/www/carei/server/patch-db.cjs

echo ""
echo ">>> Fixing server.js import paths..."
sed -i "s|./dist/api/|./api/|g" /var/www/carei/server/server.js

echo ""
echo ">>> Creating .env file..."
cat > /var/www/carei/server/.env << 'ENVEOF'
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://carei:CareiDB2026!Secure@127.0.0.1:5433/carei
ENVEOF

echo ""
echo ">>> Testing server..."
cd /var/www/carei/server
timeout 8 node server.js 2>&1 || true

echo ""
echo ">>> Setup complete!"
