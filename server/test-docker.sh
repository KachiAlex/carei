#!/bin/bash
echo "Testing imports inside container..."
docker exec carei-api node -e "
import('./dist/api/visits.js')
  .then(m => console.log('visits.js default:', typeof m.default))
  .catch(e => console.error('visits ERR:', e.message))
import('./dist/api/auth/login.js')
  .then(m => console.log('auth/login.js default:', typeof m.default))
  .catch(e => console.error('auth/login ERR:', e.message))
"
echo "---"
echo "Testing curl..."
curl -s http://127.0.0.1:3001/health
echo ""
curl -s http://127.0.0.1:3001/api/visits
echo ""
curl -s -X POST http://127.0.0.1:3001/api/auth/login -H 'Content-Type: application/json' -d '{}'
echo ""
echo "---"
echo "Container logs (last 20):"
docker logs carei-api 2>&1 | tail -20
