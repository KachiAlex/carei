import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCaregiver, createClient } from './client'

describe('createCaregiver', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('successfully creates a caregiver', async () => {
    const mockResponse = {
      status: 'created',
      caregiver: { id: 'cg-123', name: 'Jane Doe', email: 'jane@example.com', phone: '5551234', region: 'North', role: 'carer' },
    }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await createCaregiver({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '5551234',
      region: 'North',
      pin: '1234',
      role: 'carer',
    })

    expect(result).toEqual(mockResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/manager/caregivers'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('jane@example.com'),
      })
    )
  })

  it('throws on duplicate email (409)', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Email already registered' }),
    })

    await expect(
      createCaregiver({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '5551234',
        region: 'North',
        pin: '1234',
      })
    ).rejects.toThrow('Email already registered')
  })

  it('throws on network error', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('Network failure'))

    await expect(
      createCaregiver({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '5551234',
        region: 'North',
        pin: '1234',
      })
    ).rejects.toThrow('Network failure')
  })
})

describe('createClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('successfully creates a client', async () => {
    const mockResponse = { id: 'cl-123', name: 'Mary Johnson', age: 78 }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await createClient({
      id: 'cl-123',
      name: 'Mary Johnson',
      age: 78,
      address: '123 Main St',
      conditions: ['Diabetes'],
      medications: [{ name: 'Metformin', dose: '500mg', frequency: 'daily' }],
    })

    expect(result).toEqual(mockResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/clients'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Mary Johnson'),
      })
    )
  })

  it('successfully creates a client with minimal fields', async () => {
    const mockResponse = { id: 'cl-456', name: 'Tom Adams' }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await createClient({
      id: 'cl-456',
      name: 'Tom Adams',
    })

    expect(result).toEqual(mockResponse)
  })

  it('throws on server error', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database error' }),
    })

    await expect(
      createClient({
        id: 'cl-789',
        name: 'Test Client',
      })
    ).rejects.toThrow('Database error')
  })
})
