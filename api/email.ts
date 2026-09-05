interface EmailPayload {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(
      `[EMAIL FALLBACK] To: ${payload.to}\nSubject: ${payload.subject}\n${payload.html}`
    )
    return
  }

  const from = payload.from || process.env.RESEND_FROM_EMAIL || 'CAREi <onboarding@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend email error:', err)
    } else {
      const data = await res.json()
      console.log('Email sent:', data.id)
    }
  } catch (err: any) {
    console.error('Email send failed:', err.message)
  }
}
