import type { VercelRequest, VercelResponse } from '@vercel/node'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { setCors, getAuthToken, getUserFromToken, getSql } from './db.js'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT || '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET = process.env.R2_BUCKET || 'careiapp'
const PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    const { fileName, fileType, fileData, folder } = req.body || {}

    if (!fileName || !fileData) {
      res.status(400).json({ error: 'fileName and fileData required' })
      return
    }

    // fileData is expected to be a base64 data URL: data:image/jpeg;base64,/9j/...
    const match = fileData.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      res.status(400).json({ error: 'fileData must be a base64 data URL' })
      return
    }

    const [, mimeType, base64] = match
    const buffer = Buffer.from(base64, 'base64')

    // Reject files larger than 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'File too large. Max 10MB.' })
      return
    }

    const ext = fileName.split('.').pop() || 'bin'
    const key = `${folder || 'uploads'}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    )

    const url = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `r2://${BUCKET}/${key}`
    res.status(200).json({ url, key })
  } catch (err: any) {
    console.error('[upload] error:', err)
    res.status(500).json({ error: err.message || 'Upload failed' })
  }
}
