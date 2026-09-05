import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 512

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { transcript } = req.body || {}
  if (!transcript || typeof transcript !== 'string') {
    res.status(400).json({ error: 'Transcript is required' })
    return
  }

  if (!ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'AI service not configured' })
    return
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: 'You are a care documentation assistant. Extract structured care notes from voice transcripts. Return a concise summary with: key observations, tasks completed, mood/appetite/mobility indicators, and any concerns. Use bullet points.',
        messages: [{ role: 'user', content: `Transcript: "${transcript}"\n\nExtract structured care notes.` }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(502).json({ error: 'Anthropic API error', detail: err })
      return
    }

    const data = await response.json()
    const summary = data.content?.[0]?.text || 'No summary generated.'
    res.status(200).json({ summary, tokens: data.usage?.output_tokens })
  } catch (e: any) {
    res.status(500).json({ error: 'Internal error', detail: e.message })
  }
}
