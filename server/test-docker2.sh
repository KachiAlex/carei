#!/bin/bash
echo "=== Health check from inside container ==="
docker exec carei-api node -e '
fetch("http://localhost:3001/health")
  .then(r => r.text())
  .then(t => console.log("HEALTH:", t))
  .catch(e => console.error("ERR:", e.message))
'
echo ""
echo "=== Check /api/visits from inside container ==="
docker exec carei-api node -e '
fetch("http://localhost:3001/api/visits")
  .then(r => r.text())
  .then(t => console.log("VISITS:", t))
  .catch(e => console.error("ERR:", e.message))
'
echo ""
echo "=== Check what is listening on 3001 ==="
docker exec carei-api node -e '
const net = require("net");
const s = net.createConnection(3001, "localhost", () => {
  console.log("Connected to 3001");
  s.end();
});
s.on("error", (e) => console.log("Error:", e.message));
'
echo ""
echo "=== Full server.js in container ==="
docker exec carei-api cat /app/server.js
