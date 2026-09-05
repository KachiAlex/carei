import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { message, context } = req.body || {}
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' })
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
        system: `You are CAREi, an AI care assistant for frontline carers in the UK. You help with care questions, medication queries, and documentation. Be concise, accurate, and always prioritize safety. If asked about medications, proactively surface known allergies and flags from the care context.\n\nCare context: ${context || 'General care query.'}`,
        messages: [{ role: 'user', content: message }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(502).json({ error: 'Anthropic API error', detail: err })
      return
    }

    const data = await response.json()
    const reply = data.content?.[0]?.text || 'No response from AI.'
    res.status(200).json({ reply, tokens: data.usage?.output_tokens })
  } catch (e: any) {
    res.status(500).json({ error: 'Internal error', detail: e.message })
  }
}
