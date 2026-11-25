import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enqueue, getQueue, retryItem, removeFromQueue } from '../utils/offlineQueue'

const mocks = vi.hoisted(() => ({
  saveVisit: vi.fn(),
  sendSOS: vi.fn(),
  logMedication: vi.fn(),
  saveVoiceMemo: vi.fn(),
  reportIncident: vi.fn(),
  saveBodyMapMark: vi.fn(),
  sendFamilyMessage: vi.fn(),
  updateVisitApproval: vi.fn(),
  saveVisitDraft: vi.fn(),
  completeTask: vi.fn(),
  addTaskLog: vi.fn(),
  startTask: vi.fn(),
  updateClient: vi.fn(),
  createClient: vi.fn(),
  updateProfile: vi.fn(),
  createCaregiver: vi.fn(),
  replayApiRequest: vi.fn(),
}))

vi.mock('../api/client', () => mocks)

import { processQueue } from './useOnlineSync'

async function clearQueue() {
  for (const item of await getQueue()) {
    await removeFromQueue(item.id!)
  }
}

function online(value = true) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

describe('processQueue — exactly-once replay', () => {
  beforeEach(async () => {
    await clearQueue()
    vi.clearAllMocks()
    online(true)
    Object.values(mocks).forEach((m) => m.mockResolvedValue({ ok: true }))
  })

  it('delivers a queued item exactly once and removes it', async () => {
    await enqueue({ type: 'sos', payload: { lat: 51.5 } })

    await processQueue()

    expect(mocks.sendSOS).toHaveBeenCalledTimes(1)
    expect(mocks.sendSOS).toHaveBeenCalledWith({ lat: 51.5 })
    expect(await getQueue()).toHaveLength(0)
  })

  it('does nothing while offline and leaves the queue intact', async () => {
    await enqueue({ type: 'sos', payload: {} })
    online(false)

    await processQueue()

    expect(mocks.sendSOS).not.toHaveBeenCalled()
    expect(await getQueue()).toHaveLength(1)
  })

  it('keeps a failed item in the queue and increments retries', async () => {
    await enqueue({ type: 'sos', payload: {} })
    mocks.sendSOS.mockRejectedValueOnce(new Error('network'))

    await processQueue()

    const [item] = await getQueue()
    expect(item.retries).toBe(1)
    expect(mocks.sendSOS).toHaveBeenCalledTimes(1)
  })

  it('delivers after a transient failure — recovery, not loss', async () => {
    await enqueue({ type: 'sos', payload: {} })
    mocks.sendSOS.mockRejectedValueOnce(new Error('offline blip'))

    await processQueue() // fails, retries=1
    await processQueue() // succeeds

    expect(mocks.sendSOS).toHaveBeenCalledTimes(2)
    expect(await getQueue()).toHaveLength(0)
  })

  it('dead-letters items that exceed the retry cap — never delivered again', async () => {
    await enqueue({ type: 'sos', payload: {} })
    const [item] = await getQueue()
    for (let i = 0; i < 6; i++) await retryItem(item.id!)

    await processQueue()

    expect(mocks.sendSOS).not.toHaveBeenCalled()
    // Item stays in the queue (dead-lettered) rather than being silently deleted
    expect(await getQueue()).toHaveLength(1)
  })

  it('processes items in FIFO order', async () => {
    await enqueue({ type: 'sos', payload: { n: 1 } })
    await enqueue({ type: 'medication-log', payload: { n: 2 } })
    await enqueue({ type: 'sos', payload: { n: 3 } })

    await processQueue()

    expect(mocks.sendSOS.mock.calls.map((c) => (c[0] as any).n)).toEqual([1, 3])
    expect(mocks.logMedication).toHaveBeenCalledWith({ n: 2 })
    expect(await getQueue()).toHaveLength(0)
  })

  it('continues past a failure — one bad item does not block the rest', async () => {
    await enqueue({ type: 'sos', payload: {} })
    await enqueue({ type: 'medication-log', payload: {} })
    mocks.sendSOS.mockRejectedValueOnce(new Error('boom'))

    await processQueue()

    expect(mocks.logMedication).toHaveBeenCalledTimes(1)
    expect(await getQueue()).toHaveLength(1)
  })

  it('guards against concurrent runs — a second call returns immediately', async () => {
    await enqueue({ type: 'sos', payload: {} })
    let release: () => void
    mocks.sendSOS.mockImplementationOnce(() => new Promise((r) => { release = () => r({}) }))

    const first = processQueue()
    await vi.waitFor(() => expect(release!).toBeTypeOf('function'))
    const second = processQueue() // should no-op while first holds the lock

    release!()
    await Promise.all([first, second])
    expect(mocks.sendSOS).toHaveBeenCalledTimes(1)
  })

  it('routes each queue type to the right API call', async () => {
    await enqueue({ type: 'task-complete', payload: { taskId: 't1' } })
    await enqueue({ type: 'family-message', payload: { clientId: 'c1', message: 'hi' } })
    await enqueue({ type: 'api-request', payload: { path: '/x', method: 'POST', body: { a: 1 } } })

    await processQueue()

    expect(mocks.completeTask).toHaveBeenCalledWith({ taskId: 't1' })
    expect(mocks.sendFamilyMessage).toHaveBeenCalledWith('c1', 'hi')
    expect(mocks.replayApiRequest).toHaveBeenCalledWith('/x', 'POST', { a: 1 })
    expect(await getQueue()).toHaveLength(0)
  })

  it('skips unknown item types without calling any API', async () => {
    await enqueue({ type: 'bogus-type' as any, payload: {} })

    await processQueue()

    Object.values(mocks).forEach((m) => expect(m).not.toHaveBeenCalled())
    // Unknown items remain queued rather than being dropped silently
    expect(await getQueue()).toHaveLength(1)
  })

  // Dedup happens at enqueue time: an identical type+payload already in the
  // queue is not added again (protects against offline double-taps).
  it('dedupes identical enqueued actions — delivered exactly once', async () => {
    const payload = { note: 'same action' }
    await enqueue({ type: 'incident', payload })
    await enqueue({ type: 'incident', payload })

    expect(await getQueue()).toHaveLength(1)

    await processQueue()
    expect(mocks.reportIncident).toHaveBeenCalledTimes(1)
    expect(await getQueue()).toHaveLength(0)
  })

  it('still queues two genuinely different actions of the same type', async () => {
    await enqueue({ type: 'incident', payload: { note: 'fall' } })
    await enqueue({ type: 'incident', payload: { note: 'bruise' } })

    await processQueue()
    expect(mocks.reportIncident).toHaveBeenCalledTimes(2)
  })
})
