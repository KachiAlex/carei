import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendEmail } from './email.js'

describe('sendEmail', () => {
  let originalEnv: string | undefined
  let fetchSpy: any

  beforeEach(() => {
    originalEnv = process.env.RESEND_API_KEY
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-123' }),
    } as any)
  })

  afterEach(() => {
    process.env.RESEND_API_KEY = originalEnv
    vi.restoreAllMocks()
  })

  it('sends via Resend when API key is set', async () => {
    process.env.RESEND_API_KEY = 're_test_key'

    await sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
        }),
        body: expect.stringContaining('user@example.com'),
      })
    )
  })

  it('uses custom from address when provided', async () => {
    process.env.RESEND_API_KEY = 're_test_key'

    await sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      from: 'Custom <custom@example.com>',
    })

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.from).toBe('Custom <custom@example.com>')
  })

  it('falls back to console when no API key is set', async () => {
    delete process.env.RESEND_API_KEY
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('EMAIL FALLBACK')
    )
    consoleSpy.mockRestore()
  })

  it('logs error on failed Resend request', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    fetchSpy.mockResolvedValue({
      ok: false,
      text: async () => 'Invalid API key',
    } as any)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      'Resend email error:',
      'Invalid API key'
    )
    consoleSpy.mockRestore()
  })
})
