import { neon } from '@neondatabase/serverless'
import { writeFileSync } from 'fs'

const NEON_URL = 'postgresql://neondb_owner:npg_nTGoBeyY0Hz2@ep-curly-bar-abck2u9o-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
const sql = neon(NEON_URL)

async function migrate() {
  console.log('>>> Fetching schema from Neon...')
  
  // Get all tables
  const tables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `
  console.log(`Found ${tables.length} tables:`, tables.map(t => t.tablename).join(', '))

  // Get all indexes
  const indexes = await sql`
    SELECT indexname, tablename, indexdef 
    FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname
  `
  console.log(`Found ${indexes.length} indexes`)

  // Build schema SQL
  let schemaSql = '-- CAREi Database Schema Export\n-- Generated: ' + new Date().toISOString() + '\n\n'
  
  // Get CREATE TABLE statements via pg_get_tabledef or manual
  for (const table of tables) {
    const tableName = table.tablename
    console.log(`  Building schema for: ${tableName}`)
    
    // Get columns
    const columns = await sql`
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        character_maximum_length,
        column_default,
        is_nullable,
        ordinal_position
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = ${tableName}
      ORDER BY ordinal_position
    `
    
    // Get constraints
    const constraints = await sql.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'public.${tableName}'::regclass
      ORDER BY conname
    `)
    
    // Build CREATE TABLE
    const columnDefs = columns.map(c => {
      let dataType = c.data_type
      // Handle ARRAY type - udt_name for arrays has leading underscore (e.g. _text -> text[])
      if (c.data_type === 'ARRAY') {
        dataType = c.udt_name.replace(/^_/, '') + '[]'
      }
      // Handle USER-DEFINED (enum, composite) types
      if (c.data_type === 'USER-DEFINED') {
        dataType = c.udt_name
      }
      let line = `  "${c.column_name}" ${dataType}`
      if (c.character_maximum_length) line += `(${c.character_maximum_length})`
      if (c.column_default) line += ` DEFAULT ${c.column_default}`
      if (c.is_nullable === 'NO') line += ' NOT NULL'
      return line
    })
    
    // Add primary key constraint inline
    const pkConstraint = constraints.find(c => c.contype === 'p')
    if (pkConstraint) {
      columnDefs.push(`  CONSTRAINT "${pkConstraint.conname}" ${pkConstraint.def}`)
    }
    
    schemaSql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${columnDefs.join(',\n')}\n);\n\n`
    
    // Add other constraints (unique, check, foreign key)
    for (const con of constraints.filter(c => c.contype !== 'p')) {
      schemaSql += `ALTER TABLE "${tableName}" ADD CONSTRAINT "${con.conname}" ${con.def};\n`
    }
    schemaSql += '\n'
  }
  
  // Add indexes
  for (const idx of indexes) {
    if (!idx.indexdef.includes('CREATE UNIQUE INDEX')) {
      schemaSql += `${idx.indexdef};\n`
    }
  }
  
  writeFileSync('export_schema.sql', schemaSql)
  console.log(`\nSchema written to export_schema.sql (${schemaSql.split('\n').length} lines)`)
  
  // Now export data
  console.log('\n>>> Fetching data from Neon...')
  let dataSql = '-- CAREi Data Export\n-- Generated: ' + new Date().toISOString() + '\n\n'
  dataSql += 'SET session_replication_role = replica;\n\n'
  
  for (const table of tables) {
    const tableName = table.tablename
    console.log(`  Exporting data from: ${tableName}`)
    
    const rows = await sql.query(`SELECT * FROM "${tableName}"`)
    if (rows.length === 0) {
      console.log(`    (empty)`)
      continue
    }
    
    const columns = Object.keys(rows[0])
    
    for (const row of rows) {
      const values = columns.map(c => {
        const val = row[c]
        if (val === null) return 'NULL'
        if (typeof val === 'number') return val.toString()
        if (typeof val === 'boolean') return val ? 'true' : 'false'
        if (Array.isArray(val)) {
          // PostgreSQL array literal: {elem1,elem2,...}
          // Each element needs to be quoted with double quotes if it contains special chars
          const elems = val.map(v => {
            const s = String(v)
            // Quote if contains comma, brace, quote, backslash, or space
            if (/[,{}"\\]/.test(s) || s === '') {
              return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
            }
            return s
          })
          return `'{${elems.join(',')}}'`
        }
        if (typeof val === 'object') {
          return `'${JSON.stringify(val).replace(/'/g, "''")}'`
        }
        // String - escape single quotes
        return `'${String(val).replace(/'/g, "''")}'`
      })
      
      dataSql += `INSERT INTO "${tableName}" ("${columns.join('","')}") VALUES (${values.join(',')});\n`
    }
    dataSql += '\n'
    console.log(`    ${rows.length} rows`)
  }
  
  dataSql += '\nSET session_replication_role = DEFAULT;\n'
  writeFileSync('export_data.sql', dataSql)
  console.log(`\nData written to export_data.sql (${dataSql.split('\n').length} lines)`)
  
  console.log('\n>>> Export complete!')
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
