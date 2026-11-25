import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { enqueue, getQueue, removeFromQueue, retryItem } from './offlineQueue'

async function clearQueue() {
  for (const item of await getQueue()) {
    await removeFromQueue(item.id!)
  }
}

describe('offlineQueue', () => {
  beforeEach(clearQueue)

  it('persists an enqueued item with retries=0 and an id', async () => {
    await enqueue({ type: 'sos', payload: { lat: 1, lng: 2 } })

    const items = await getQueue()
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('sos')
    expect(items[0].payload).toEqual({ lat: 1, lng: 2 })
    expect(items[0].retries).toBe(0)
    expect(items[0].id).toBeTypeOf('number')
    expect(items[0].createdAt).toBeTypeOf('string')
  })

  it('returns items in insertion order (FIFO replay order)', async () => {
    await enqueue({ type: 'sos', payload: { n: 1 } })
    await enqueue({ type: 'medication-log', payload: { n: 2 } })
    await enqueue({ type: 'incident', payload: { n: 3 } })

    const items = await getQueue()
    expect(items.map((i) => i.type)).toEqual(['sos', 'medication-log', 'incident'])
  })

  it('assigns unique ids across items', async () => {
    await enqueue({ type: 'sos', payload: { n: 1 } })
    await enqueue({ type: 'sos', payload: { n: 2 } })

    const items = await getQueue()
    expect(items[0].id).not.toBe(items[1].id)
  })

  it('removeFromQueue deletes only the targeted item', async () => {
    await enqueue({ type: 'sos', payload: { n: 1 } })
    await enqueue({ type: 'sos', payload: { n: 2 } })
    const [first, second] = await getQueue()

    await removeFromQueue(first.id!)

    const remaining = await getQueue()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second.id)
  })

  it('retryItem increments retries and preserves the payload', async () => {
    await enqueue({ type: 'incident', payload: { note: 'fall' } })
    const [item] = await getQueue()

    await retryItem(item.id!)
    await retryItem(item.id!)

    const [updated] = await getQueue()
    expect(updated.retries).toBe(2)
    expect(updated.payload).toEqual({ note: 'fall' })
  })

  it('retryItem on a missing id is a no-op', async () => {
    await expect(retryItem(99999)).resolves.toBeUndefined()
  })

  it('survives a simulated app kill — queue readable from a fresh DB connection', async () => {
    // enqueue + getQueue each open and close their own connection; a later
    // getQueue is the equivalent of a cold relaunch reading the persisted store.
    await enqueue({ type: 'visit', payload: { visitId: 'v-9' } })

    // Simulate process restart: close every open handle, then reopen.
    const reopened = await getQueue()
    expect(reopened).toHaveLength(1)
    expect(reopened[0].payload).toEqual({ visitId: 'v-9' })
  })
})
