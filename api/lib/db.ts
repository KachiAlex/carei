import { neon } from '@neondatabase/serverless'

let _sql: ReturnType<typeof neon> | null = null

function getSql() {
  if (_sql) return _sql
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  _sql = neon(connectionString)
  return _sql
}

export const sql = new Proxy({} as ReturnType<typeof neon>, {
  apply(_target, _thisArg, args) {
    return getSql()(...args as [TemplateStringsArray, ...any[]])
  },
  get(_target, prop) {
    return getSql()[prop as keyof ReturnType<typeof neon>]
  },
})
