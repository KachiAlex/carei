import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug, getAuthToken, getUserFromToken, verifyTenantAccess } from '../db.js'
import { verifyToken, verifyCredential, hashCredential, generateSecureToken, hashToken } from '../hash.js'

function generateTempPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function getDefaultPermissions(role: string): string[] {
  switch (role) {
    case 'primary':
      return ['view_basic_info', 'visit_summary', 'send_messages', 'view_care_tasks', 'view_schedule', 'receive_notifications', 'view_care_plan', 'manage_family_members', 'approve_changes', 'detailed_reports', 'emergency_contacts']
    case 'secondary':
      return ['view_basic_info', 'visit_summary', 'send_messages', 'view_care_tasks', 'view_schedule', 'receive_notifications', 'view_care_plan']
    case 'limited':
      return ['view_basic_info', 'visit_summary', 'send_messages']
    default:
      return ['view_basic_info', 'visit_summary', 'send_messages']
  }
}

async function getFamilyMemberFromToken(sql: any, token: string): Promise<any | null> {
  const rows = await sql`
    SELECT id, name, email, role, permissions, client_id, tenant_id, is_active, token_hash, token_expires_at
    FROM family_members
    WHERE token_hash IS NOT NULL
  ` as any[]
  for (const row of rows) {
    const valid = await verifyToken(token, row.token_hash)
    if (valid) {
      if (row.token_expires_at && new Date(row.token_expires_at) < new Date()) {
        continue
      }
      return row
    }
  }
  return null
}

function parsePath(req: VercelRequest): string[] {
  const path = req.query?.path
  if (Array.isArray(path)) return path
  if (typeof path === 'string') return [path]
  return []
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const segments = parsePath(req)
  const sql = getSql()

  try {
    await ensureTables()

    // ─── ROUTER ───
    const route = segments.join('/')

    // ═══════════════════════════════════════════════════════════════
    //  AUTH ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    // POST /family/auth/login
    if (req.method === 'POST' && route === 'auth/login') {
      const { email, pin } = req.body || {}
      if (!email || !pin) {
        res.status(400).json({ error: 'Email and PIN are required' })
        return
      }

      const rows = await sql`
        SELECT id, name, email, role, permissions, client_id, tenant_id, is_active, pin_hash
        FROM family_members
        WHERE LOWER(email) = ${email.toLowerCase()}
        LIMIT 1
      ` as any[]

      if (!rows[0]) {
        res.status(401).json({ error: 'Invalid credentials' })
        return
      }

      const member = rows[0]
      if (!member.is_active) {
        res.status(403).json({ error: 'Account is inactive' })
        return
      }

      const valid = await verifyCredential(pin, member.pin_hash)
      if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' })
        return
      }

      const token = generateSecureToken()
      const tokenHash = await hashToken(token)
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      await sql`
        UPDATE family_members
        SET token_hash = ${tokenHash}, token_expires_at = ${tokenExpiresAt}, last_login = NOW()
        WHERE id = ${member.id}
      `

      const tenantRows = await sql`SELECT slug FROM tenants WHERE id = ${member.tenant_id} LIMIT 1` as any[]

      res.status(200).json({
        token,
        refreshToken: token,
        expiresAt: tokenExpiresAt,
        tenantSlug: tenantRows[0]?.slug || '',
        familyMember: {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          permissions: member.permissions,
          clientId: member.client_id,
          isActive: member.is_active,
        }
      })
      return
    }

    // POST /family/auth/logout
    if (req.method === 'POST' && route === 'auth/logout') {
      const token = getAuthToken(req)
      if (token) {
        const member = await getFamilyMemberFromToken(sql, token)
        if (member) {
          await sql`UPDATE family_members SET token_hash = NULL, token_expires_at = NULL WHERE id = ${member.id}`
        }
      }
      res.status(200).json({ status: 'logged out' })
      return
    }

    // POST /family/auth/refresh
    if (req.method === 'POST' && route === 'auth/refresh') {
      const { refreshToken } = req.body || {}
      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token required' })
        return
      }

      const member = await getFamilyMemberFromToken(sql, refreshToken)
      if (!member) {
        res.status(401).json({ error: 'Invalid refresh token' })
        return
      }

      const newToken = generateSecureToken()
      const tokenHash = await hashToken(newToken)
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      await sql`
        UPDATE family_members
        SET token_hash = ${tokenHash}, token_expires_at = ${tokenExpiresAt}
        WHERE id = ${member.id}
      `

      res.status(200).json({
        token: newToken,
        refreshToken: newToken,
        expiresAt: tokenExpiresAt,
      })
      return
    }

    // POST /family/auth/forgot-password
    if (req.method === 'POST' && route === 'auth/forgot-password') {
      const { email } = req.body || {}
      if (!email) {
        res.status(400).json({ error: 'Email required' })
        return
      }
      // In a real implementation, send an email with a reset link.
      // For now, just acknowledge.
      res.status(200).json({ status: 'If an account exists, a reset email has been sent.' })
      return
    }

    // POST /family/auth/reset-password
    if (req.method === 'POST' && route === 'auth/reset-password') {
      const { token: resetToken, pin } = req.body || {}
      if (!resetToken || !pin) {
        res.status(400).json({ error: 'Token and new PIN required' })
        return
      }
      res.status(200).json({ status: 'PIN reset successful' })
      return
    }

    // POST /family/auth/register
    if (req.method === 'POST' && route === 'auth/register') {
      const { name, email, phoneNumber, relationship, clientId, role } = req.body || {}
      if (!name || !email || !relationship || !clientId) {
        res.status(400).json({ error: 'name, email, relationship, and clientId are required' })
        return
      }
      const tempPin = generateTempPin()
      const pinHash = await hashCredential(tempPin)
      const memberId = 'fm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
      const permissions = getDefaultPermissions(role || 'secondary')

      await sql`
        INSERT INTO family_members (id, tenant_id, client_id, name, email, phone, relationship, role, permissions, pin_hash, is_active)
        VALUES (${memberId}, '', ${clientId}, ${name}, ${email.toLowerCase()}, ${phoneNumber || null}, ${relationship}, ${role || 'secondary'}, ${permissions}, ${pinHash}, TRUE)
      `

      res.status(200).json({
        id: memberId,
        name,
        email: email.toLowerCase(),
        role: role || 'secondary',
        tempPin,
      })
      return
    }

    // ═══════════════════════════════════════════════════════════════
    //  MEMBER MANAGEMENT ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    // POST /family/members/invite  or  GET /family/members
    // PATCH /family/members/:id      or  DELETE /family/members/:id
    if (route === 'members/invite' || route === 'members' || route.startsWith('members/')) {
      const tenantSlug = getTenantSlug(req)

      if (!tenantSlug) {
        res.status(400).json({ error: 'Tenant slug required' })
        return
      }

      await withTenant(req, res, async ({ tenantId, userId, role }) => {
        if (role !== 'manager' && role !== 'admin' && role !== 'superadmin') {
          res.status(403).json({ error: 'Only managers can manage family members' })
          return
        }

        if (req.method === 'POST' && route === 'members/invite') {
          const { name, email, relationship, role: memberRole, clientId, phoneNumber } = req.body || {}
          if (!name || !email || !relationship || !clientId) {
            res.status(400).json({ error: 'name, email, relationship, and clientId are required' })
            return
          }

          const clientRows = await sql`SELECT id FROM clients WHERE id = ${clientId} AND tenant_id = ${tenantId}`
          if (!clientRows[0]) {
            res.status(404).json({ error: 'Client not found' })
            return
          }

          const tempPin = generateTempPin()
          const pinHash = await hashCredential(tempPin)
          const memberId = 'fm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
          const permissions = getDefaultPermissions(memberRole || 'secondary')

          await sql`
            INSERT INTO family_members (id, tenant_id, client_id, name, email, phone, relationship, role, permissions, pin_hash, is_active, invited_by)
            VALUES (${memberId}, ${tenantId}, ${clientId}, ${name}, ${email.toLowerCase()}, ${phoneNumber || null}, ${relationship}, ${memberRole || 'secondary'}, ${permissions}, ${pinHash}, TRUE, ${userId})
          `

          res.status(200).json({
            id: memberId,
            name,
            email: email.toLowerCase(),
            relationship,
            role: memberRole || 'secondary',
            clientId,
            tempPin,
            isActive: true,
            createdAt: new Date().toISOString(),
          })
          return
        }

        if (req.method === 'GET' && route === 'members') {
          const { clientId } = req.query as { clientId?: string }
          if (!clientId) {
            res.status(400).json({ error: 'clientId query parameter required' })
            return
          }

          const rows = await sql`
            SELECT
              id,
              name,
              email,
              phone,
              relationship,
              role,
              permissions,
              is_active as "isActive",
              invited_by as "invitedBy",
              created_at as "createdAt",
              last_login as "lastLogin"
            FROM family_members
            WHERE tenant_id = ${tenantId} AND client_id = ${clientId}
            ORDER BY created_at DESC
          ` as any[]

          res.status(200).json(rows)
          return
        }

        const memberIdMatch = route.match(/^members\/(.+)$/)
        if (memberIdMatch) {
          const memberId = memberIdMatch[1]

          if (req.method === 'PATCH') {
            const { name, phoneNumber, role: memberRole, isActive } = req.body || {}
            await sql`
              UPDATE family_members
              SET
                name = COALESCE(${name !== undefined ? name : null}, name),
                phone = COALESCE(${phoneNumber !== undefined ? phoneNumber : null}, phone),
                role = COALESCE(${memberRole !== undefined ? memberRole : null}, role),
                is_active = COALESCE(${isActive !== undefined ? isActive : null}, is_active),
                updated_at = NOW()
              WHERE id = ${memberId} AND tenant_id = ${tenantId}
            `
            res.status(200).json({ status: 'updated' })
            return
          }

          if (req.method === 'DELETE') {
            await sql`DELETE FROM family_members WHERE id = ${memberId} AND tenant_id = ${tenantId}`
            res.status(200).json({ status: 'deleted' })
            return
          }
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // ═══════════════════════════════════════════════════════════════
    //  FAMILY-AUTHENTICATED ENDPOINTS (require family token)
    // ═══════════════════════════════════════════════════════════════

    const authHeader = req.headers?.authorization || ''
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/)
    const familyToken = bearerMatch ? bearerMatch[1] : ''

    if (!familyToken) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const member = await getFamilyMemberFromToken(sql, familyToken)
    if (!member) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    if (!member.is_active) {
      res.status(403).json({ error: 'Account is inactive' })
      return
    }

    const tenantId = member.tenant_id
    const clientId = member.client_id

    // GET /family/dashboard
    if (req.method === 'GET' && route === 'dashboard') {
      const clientRows = await sql`
        SELECT id, name, age, conditions
        FROM clients
        WHERE id = ${clientId} AND tenant_id = ${tenantId}
        LIMIT 1
      ` as any[]

      const client = clientRows[0] || { id: clientId, name: 'Unknown', age: null, conditions: null }

      const visitRows = await sql`
        SELECT
          id,
          submitted_at as "submittedAt",
          elapsed,
          notes,
          mood,
          carer_name as "carerName"
        FROM visits
        WHERE client_id = ${clientId} AND tenant_id = ${tenantId}
        ORDER BY submitted_at DESC
        LIMIT 5
      ` as any[]

      const messageRows = await sql`
        SELECT COUNT(*) as count
        FROM family_messages
        WHERE client_id = ${clientId}
      ` as any[]

      res.status(200).json({
        familyMember: {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          permissions: member.permissions,
          clientId: member.client_id,
          isActive: member.is_active,
        },
        clients: [{
          id: client.id,
          name: client.name,
          age: client.age,
          condition: client.conditions?.[0] || '',
          lastVisit: visitRows[0]?.submittedAt || null,
          nextVisit: null,
          unreadMessages: parseInt(messageRows[0]?.count || '0', 10),
          pendingTasks: 0,
          moodStatus: 'good',
        }],
        notifications: [],
        recentActivity: visitRows.map((v: any) => ({
          id: v.id,
          type: 'visit_completed',
          description: `Visit by ${v.carerName || 'carer'}`,
          timestamp: v.submittedAt,
          clientId: clientId,
          clientName: client.name,
        })),
      })
      return
    }

    // GET /family/clients/:id
    if (req.method === 'GET' && route.startsWith('clients/') && !route.includes('/tasks') && !route.includes('/messages') && !route.includes('/visits')) {
      const id = route.replace('clients/', '')
      const clientRows = await sql`
        SELECT id, name, age, conditions, preferences, emergency_contact as "emergencyContact"
        FROM clients
        WHERE id = ${id} AND tenant_id = ${tenantId}
        LIMIT 1
      ` as any[]

      if (!clientRows[0]) {
        res.status(404).json({ error: 'Client not found' })
        return
      }

      res.status(200).json({
        id: clientRows[0].id,
        name: clientRows[0].name,
        age: clientRows[0].age,
        condition: clientRows[0].conditions?.[0] || '',
        carePlan: { objectives: [], preventive: [], risks: [] },
        tasks: [],
        visits: [],
        messages: [],
      })
      return
    }

    // GET /family/clients/:id/tasks
    if (req.method === 'GET' && route.match(/^clients\/[^/]+\/tasks$/)) {
      const id = route.split('/')[1]
      const rows = await sql`
        SELECT id, name as text, category, completed, due_date as "dueDate"
        FROM tasks
        WHERE client_id = ${id} AND tenant_id = ${tenantId}
        ORDER BY created_at DESC
      ` as any[]

      res.status(200).json(rows.map((r: any) => ({
        id: r.id,
        text: r.text,
        category: r.category,
        completed: r.completed,
        dueDate: r.dueDate,
        assignedTo: null,
      })))
      return
    }

    // PUT /family/clients/:id/tasks/:taskId
    if (req.method === 'PUT' && route.match(/^clients\/[^/]+\/tasks\/[^/]+$/)) {
      const parts = route.split('/')
      const taskId = parts[3]
      const { completed, notes } = req.body || {}
      await sql`
        UPDATE tasks
        SET completed = COALESCE(${completed !== undefined ? completed : null}, completed),
            updated_at = NOW()
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `
      res.status(200).json({ status: 'updated' })
      return
    }

    // GET /family/clients/:id/messages
    if (req.method === 'GET' && route.match(/^clients\/[^/]+\/messages$/)) {
      const id = route.split('/')[1]
      const rows = await sql`
        SELECT id, sender_name as "senderName", sender_role as "senderRole", message, created_at as "timestamp"
        FROM family_messages
        WHERE client_id = ${id}
        ORDER BY created_at DESC
        LIMIT 50
      ` as any[]

      res.status(200).json(rows.map((r: any) => ({
        id: r.id,
        senderName: r.senderName,
        senderRole: r.senderRole,
        message: r.message,
        timestamp: r.timestamp,
        isFromFamily: r.senderRole === 'family',
      })))
      return
    }

    // POST /family/clients/:id/messages
    if (req.method === 'POST' && route.match(/^clients\/[^/]+\/messages$/)) {
      const id = route.split('/')[1]
      const { message } = req.body || {}
      if (!message) {
        res.status(400).json({ error: 'message required' })
        return
      }

      const msgId = 'fm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
      await sql`
        INSERT INTO family_messages (id, visit_id, client_id, sender_name, sender_role, message)
        VALUES (${msgId}, NULL, ${id}, ${member.name}, 'family', ${message})
      `

      res.status(200).json({ id: msgId, status: 'saved' })
      return
    }

    // GET /family/clients/:id/visits
    if (req.method === 'GET' && route.match(/^clients\/[^/]+\/visits$/)) {
      const id = route.split('/')[1]
      const rows = await sql`
        SELECT
          id,
          submitted_at as date,
          elapsed as duration,
          carer_name as "carerName",
          mood,
          notes as summary,
          approval_status as status
        FROM visits
        WHERE client_id = ${id} AND tenant_id = ${tenantId}
          AND approval_status IN ('approved', 'released')
        ORDER BY submitted_at DESC
        LIMIT 50
      ` as any[]

      res.status(200).json(rows.map((r: any) => ({
        id: r.id,
        date: r.date,
        duration: r.duration || 0,
        carerName: r.carerName || '',
        mood: r.mood,
        nutritionNote: '',
        summary: r.summary || '',
        status: r.status === 'released' ? 'completed' : r.status || 'completed',
      })))
      return
    }

    // GET /family/notifications
    if (req.method === 'GET' && route === 'notifications') {
      res.status(200).json([])
      return
    }

    // PUT /family/notifications/:id/read
    if (req.method === 'PUT' && route.match(/^notifications\/[^/]+\/read$/)) {
      res.status(200).json({ status: 'marked read' })
      return
    }

    // PUT /family/notifications/read-all
    if (req.method === 'PUT' && route === 'notifications/read-all') {
      res.status(200).json({ status: 'all marked read' })
      return
    }

    res.status(404).json({ error: 'Not found' })
  } catch (err: any) {
    console.error('Family API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
