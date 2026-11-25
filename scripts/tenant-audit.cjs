const fs = require('fs')
const path = require('path')

const files = []
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f).replace(/\\/g, '/')
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts') && !['api/db.ts', 'api/hash.ts'].includes(p)) files.push(p)
  }
}
walk('api')

const scopedTables =
  /clients|visits|tenant_users|medications|medication_log|incidents|documents|voice_memos|push_tokens|schedule|tasks|messages|audit_logs|care_plans|supervisions|training|dbs_checks|invites|invite_links|family|availability|sos|body_map|outcome|risk_alerts|staff_matching|compliance|right_to_work|data-retention|users\b/i

for (const f of files.sort()) {
  const src = fs.readFileSync(f, 'utf8')
  const wt = /withTenant\s*\(/.test(src)
  const tid = /tenant_id|tenantId|verifyTenantAccess|tenant_users/.test(src)
  const auth = /getUserFromToken|Authorization|token/.test(src)
  const scoped = scopedTables.test(src)
  const cls = wt ? 'withTenant' : tid ? 'tenant-aware' : !scoped ? 'global' : auth ? 'user-scoped' : 'FLAG'
  console.log(cls.padEnd(14), f)
}
