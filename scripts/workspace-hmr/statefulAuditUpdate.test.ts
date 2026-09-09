import { describe, expect, it, vi } from 'vitest'
import { StatefulHmrAuditClient } from './statefulAuditClient'
import { waitForStatefulHmrAuditUpdate } from './statefulAuditUpdate'

describe('stateful HMR audit mutation acknowledgement', () => {
  it('does not complete on an older batch before the current mutation is emitted', async () => {
    let emittedOutput = ''
    const responses = [
      { type: 'registered' },
      { type: 'batch-published', targetVersion: 1, output: 'previous mutation' },
      { type: 'changed' },
      { type: 'batch-published', targetVersion: 2, output: 'current mutation' },
    ]
    const request = vi.fn(async () => {
      const response = responses.shift()
      if (response?.output) {
        emittedOutput = response.output
      }
      return new Response(JSON.stringify(response))
    })

    await waitForStatefulHmrAuditUpdate({
      client: new StatefulHmrAuditClient(request),
      readControl: async () => ({ buildId: 'build-a', token: 'test-token', url: 'http://localhost/control' }),
      isCurrentUpdate: async () => emittedOutput === 'current mutation',
      timeoutMs: 1_000,
    })

    expect(emittedOutput).toBe('current mutation')
  })

  it('fails at the deadline when acknowledged batches never contain the mutation', async () => {
    vi.useFakeTimers()
    try {
      const request = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'registered' })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'batch-published', targetVersion: 1 })))
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(new Response(JSON.stringify({ type: 'idle' }))), 25)))
      const pending = waitForStatefulHmrAuditUpdate({
        client: new StatefulHmrAuditClient(request),
        readControl: async () => ({ buildId: 'build-a', token: 'test-token', url: 'http://localhost/control' }),
        isCurrentUpdate: async () => false,
        timeoutMs: 100,
      })
      const rejected = expect(pending).rejects.toThrow(Error)
      await vi.advanceTimersByTimeAsync(150)
      await rejected
    }
    finally {
      vi.useRealTimers()
    }
  })
})
