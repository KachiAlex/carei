// PostgreSQL compatibility layer for local pg driver
// Provides the same tagged template interface as Neon's neon() function
import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL not set')
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return pool
}

// Tagged template function that mimics Neon's sql tagged template
// Usage: sql`SELECT * FROM users WHERE id = ${userId}`
function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  const pool = getPool()
  let query = strings[0]
  const params: any[] = []

  for (let i = 0; i < values.length; i++) {
    params.push(values[i])
    query += `$${i + 1}` + strings[i + 1]
  }

  return pool.query(query, params).then(res => res.rows)
}

// Add .query method for raw queries (used by export script)
;(sql as any).query = async (text: string, values?: any[]) => {
  const pool = getPool()
  const res = await pool.query(text, values)
  return res.rows
}

// Also export as a function that can be called to get the sql function
export function getSql() {
  return sql as any
}

// Client for transactions
export function getClient() {
  const pool = getPool()
  return pool.connect()
}

// Re-export Pool for direct use
export { Pool }
