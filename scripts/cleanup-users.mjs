import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const envContent = readFileSync('.env.local', 'utf-8')
const match = envContent.match(/DATABASE_URL=(.+)/)
let connectionString = match ? match[1].trim() : ''
connectionString = connectionString.replace(/^["']|["']$/g, '')
if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(connectionString)

async function cleanup() {
  const before = await sql`SELECT id, email, name, role FROM users ORDER BY email`
  console.log('Before cleanup:', before)

  const result = await sql`DELETE FROM users WHERE email <> ${'admin@carei.com'}`
  console.log('Deleted rows:', result.count)

  const after = await sql`SELECT id, email, name, role FROM users ORDER BY email`
  console.log('After cleanup:', after)
}

cleanup().catch((err) => {
  console.error(err)
  process.exit(1)
})
