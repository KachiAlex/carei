import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from './db.js'
import handler from './upload.js'

const mockSql: any = vi.fn()
const { sendMock, putCalls } = vi.hoisted(() => ({
  sendMock: vi.fn(async () => ({})),
  putCalls: [] as any[],
}))

vi.mock('./db.js', () => ({
  getSql: vi.fn(() => mockSql),
  setCors: vi.fn(),
  getAuthToken: vi.fn((req: any) => {
    const h = req.headers?.authorization || ''
    return h.startsWith('Bearer ') ? h.slice(7) : null
  }),
  getUserFromToken: vi.fn(async () => ({ id: 'u-1', name: 'Carer', role: 'carer', email: 'c@x.com' })),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = sendMock },
  PutObjectCommand: class {
    input: any
    constructor(input: any) { this.input = input; putCalls.push(input) }
  },
}))

function makeRes() {
  const json = vi.fn()
  const status = vi.fn(() => ({ json, end: vi.fn() }))
  return { status, json, end: vi.fn(), setHeader: vi.fn() } as any
}

function reqWith(body: any, auth = 'Bearer tok'): any {
  return { method: 'POST', headers: { authorization: auth }, body }
}

function dataUrl(mime: string, bytes: number | string): string {
  const payload = typeof bytes === 'number' ? Buffer.alloc(bytes, 0x61).toString('base64') : bytes
  return `data:${mime};base64,${payload}`
}

beforeEach(() => {
  vi.clearAllMocks()
  sendMock.mockResolvedValue({} as never)
  putCalls.length = 0
})

describe('upload validation', () => {
  it('rejects unauthenticated requests', async () => {
    const res = makeRes()
    await handler(reqWith({}, ''), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects invalid tokens', async () => {
    vi.mocked(db.getUserFromToken).mockResolvedValueOnce(null)
    const res = makeRes()
    await handler(reqWith({ fileName: 'a.jpg', fileData: dataUrl('image/jpeg', 10) }), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('requires fileName and fileData', async () => {
    const res = makeRes()
    await handler(reqWith({}), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects non-data-URL payloads', async () => {
    const res = makeRes()
    await handler(reqWith({ fileName: 'a.jpg', fileData: 'not-a-data-url' }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects files larger than 10MB', async () => {
    const res = makeRes()
    await handler(reqWith({ fileName: 'big.jpg', fileData: dataUrl('image/jpeg', 11 * 1024 * 1024) }), res)
    expect(res.status).toHaveBeenCalledWith(413)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('rejects HTML — would serve as an XSS page from the public URL', async () => {
    const res = makeRes()
    await handler(reqWith({ fileName: 'x.html', fileData: dataUrl('text/html', 100) }), res)
    expect(res.status).toHaveBeenCalledWith(415)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('rejects executables and scripts', async () => {
    for (const mime of ['application/x-msdownload', 'application/javascript', 'image/svg+xml']) {
      const res = makeRes()
      await handler(reqWith({ fileName: 'f', fileData: dataUrl(mime, 50) }), res)
      expect(res.status, mime).toHaveBeenCalledWith(415)
    }
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('accepts images and stores under the user-scoped key', async () => {
    const res = makeRes()
    await handler(reqWith({ fileName: 'photo.jpg', fileData: dataUrl('image/jpeg', 100) }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(putCalls[0].Key).toMatch(/^uploads\/u-1\/.+\.jpg$/)
    expect(putCalls[0].ContentType).toBe('image/jpeg')
  })

  it('derives the extension from MIME type, not the attacker-controlled fileName', async () => {
    const res = makeRes()
    await handler(reqWith({ fileName: 'evil.html.exe', fileData: dataUrl('image/png', 100) }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(putCalls[0].Key).toMatch(/\.png$/)
    expect(putCalls[0].Key).not.toContain('html')
  })

  it('accepts voice memo audio types', async () => {
    for (const mime of ['audio/webm', 'audio/mp4']) {
      const res = makeRes()
      await handler(reqWith({ fileName: 'memo', fileData: dataUrl(mime, 100) }), res)
      expect(res.status, mime).toHaveBeenCalledWith(200)
    }
    expect(putCalls.map((c) => c.Key)).toEqual([
      expect.stringMatching(/\.webm$/),
      expect.stringMatching(/\.m4a$/),
    ])
  })

  it('sanitizes a hostile folder path', async () => {
    const res = makeRes()
    await handler(reqWith({ fileName: 'a.png', fileData: dataUrl('image/png', 100), folder: '../../etc' }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(putCalls[0].Key).toMatch(/^uploads\/u-1\//)
  })
})
