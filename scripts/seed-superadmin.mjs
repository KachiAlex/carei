import handler from '../api/seed-superadmin.ts'

async function main() {
  const req = { method: 'POST', body: {} }
  const res = {
    statusCode: 200,
    headers: {},
    jsonBody: null,
    status(code) { this.statusCode = code; return this },
    setHeader() { return this },
    json(body) { this.jsonBody = body; console.log(JSON.stringify(body, null, 2)); return this },
    end() { return this }
  }
  await handler(req, res)
}

main().catch(console.error)
