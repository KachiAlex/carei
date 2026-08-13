import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug, getAuthToken, getUserFromToken } from './db.js'

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()
    const token = getAuthToken(req)
    const user = token ? await getUserFromToken(sql, token) : null
    const currentUserId = user?.id || ''
    const currentUserName = user?.name || ''
    const currentUserRole = user?.role || ''

    // ---- GET: Conversations or messages ----
    if (req.method === 'GET') {
      const { conversationId, contacts } = req.query as {
        conversationId?: string
        contacts?: string
      }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          // Get list of potential contacts (managers if carer, all carers if manager)
          if (contacts === 'true') {
            const contactsList = await tenantSql`
              SELECT id, name, role FROM tenant_users
              WHERE tenant_id = ${tenantId} AND id != ${currentUserId}
              ORDER BY name
            ` as any[]
            res.status(200).json({ contacts: contactsList })
            return
          }

          // Get messages for a specific conversation
          if (conversationId) {
            const messages = await tenantSql`
              SELECT id, sender_id AS "senderId", sender_name AS "senderName",
                sender_role AS "senderRole", body, priority,
                read_at AS "readAt", created_at AS "createdAt"
              FROM messages
              WHERE tenant_id = ${tenantId} AND conversation_id = ${conversationId}
              ORDER BY created_at ASC
              LIMIT 200
            ` as any[]

            // Mark messages from the other person as read
            await tenantSql`
              UPDATE messages SET read_at = NOW()
              WHERE conversation_id = ${conversationId}
                AND tenant_id = ${tenantId}
                AND sender_id != ${currentUserId}
                AND read_at IS NULL
            `
            // Reset unread count for current user
            const conv = await tenantSql`
              SELECT participant1_id, participant2_id, unread_count_1, unread_count_2
              FROM conversations WHERE id = ${conversationId} AND tenant_id = ${tenantId}
            ` as any[]
            if (conv[0]) {
              if (conv[0].participant1_id === currentUserId) {
                await tenantSql`UPDATE conversations SET unread_count_1 = 0 WHERE id = ${conversationId} AND tenant_id = ${tenantId}`
              } else {
                await tenantSql`UPDATE conversations SET unread_count_2 = 0 WHERE id = ${conversationId} AND tenant_id = ${tenantId}`
              }
            }

            res.status(200).json({ messages })
            return
          }

          // Get all conversations for current user
          const conversations = await tenantSql`
            SELECT id, participant1_id AS "p1Id", participant1_name AS "p1Name",
              participant1_role AS "p1Role", participant2_id AS "p2Id",
              participant2_name AS "p2Name", participant2_role AS "p2Role",
              last_message AS "lastMessage", last_message_at AS "lastMessageAt",
              unread_count_1 AS "unread1", unread_count_2 AS "unread2",
              created_at AS "createdAt"
            FROM conversations
            WHERE tenant_id = ${tenantId}
              AND (participant1_id = ${currentUserId} OR participant2_id = ${currentUserId})
            ORDER BY last_message_at DESC NULLS LAST
          ` as any[]

          // Format for the current user's perspective
          const formatted = conversations.map((c) => {
            const isP1 = c.p1Id === currentUserId
            const otherName = isP1 ? c.p2Name : c.p1Name
            const otherRole = isP1 ? c.p2Role : c.p1Role
            const otherId = isP1 ? c.p2Id : c.p1Id
            const unread = isP1 ? c.unread1 : c.unread2
            return {
              id: c.id,
              otherId,
              otherName,
              otherRole,
              lastMessage: c.lastMessage,
              lastMessageAt: c.lastMessageAt,
              unread,
            }
          })

          res.status(200).json({ conversations: formatted })
        })
        return
      }
      res.status(200).json({ conversations: [], messages: [], contacts: [] })
      return
    }

    // ---- POST: Send message ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const { recipientId, body: messageBody, priority } = body

      if (!recipientId || !messageBody) {
        res.status(400).json({ error: 'recipientId and body required' })
        return
      }

      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          // Find or create conversation between these two users
          let conversations = await tenantSql`
            SELECT id, participant1_id, participant2_id
            FROM conversations
            WHERE tenant_id = ${tenantId}
              AND ((participant1_id = ${currentUserId} AND participant2_id = ${recipientId})
                OR (participant1_id = ${recipientId} AND participant2_id = ${currentUserId}))
          ` as any[]

          let conversationId: string
          let isP1Sender: boolean

          if (conversations.length > 0) {
            conversationId = conversations[0].id
            isP1Sender = conversations[0].participant1_id === currentUserId
          } else {
            // Get recipient name
            const recipient = await tenantSql`
              SELECT name, role FROM tenant_users
              WHERE id = ${recipientId} AND tenant_id = ${tenantId}
              LIMIT 1
            ` as any[]
            const recipientName = recipient[0]?.name || 'Unknown'
            const recipientRole = recipient[0]?.role || ''

            conversationId = genId('conv')
            await tenantSql`
              INSERT INTO conversations (
                id, tenant_id, participant1_id, participant1_name, participant1_role,
                participant2_id, participant2_name, participant2_role
              ) VALUES (
                ${conversationId}, ${tenantId},
                ${currentUserId}, ${currentUserName}, ${currentUserRole},
                ${recipientId}, ${recipientName}, ${recipientRole}
              )
            `
            isP1Sender = true
          }

          // Insert message
          const messageId = genId('msg')
          await tenantSql`
            INSERT INTO messages (
              id, tenant_id, conversation_id, sender_id, sender_name, sender_role,
              body, priority
            ) VALUES (
              ${messageId}, ${tenantId}, ${conversationId},
              ${currentUserId}, ${currentUserName}, ${currentUserRole},
              ${messageBody}, ${priority || 'normal'}
            )
          `

          // Update conversation's last message and unread count
          if (isP1Sender) {
            await tenantSql`
              UPDATE conversations SET
                last_message = ${messageBody},
                last_message_at = NOW(),
                unread_count_2 = unread_count_2 + 1
              WHERE id = ${conversationId} AND tenant_id = ${tenantId}
            `
          } else {
            await tenantSql`
              UPDATE conversations SET
                last_message = ${messageBody},
                last_message_at = NOW(),
                unread_count_1 = unread_count_1 + 1
              WHERE id = ${conversationId} AND tenant_id = ${tenantId}
            `
          }

          res.status(201).json({ status: 'sent', messageId, conversationId })
        })
        return
      }
      res.status(400).json({ error: 'Tenant required for messaging' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
