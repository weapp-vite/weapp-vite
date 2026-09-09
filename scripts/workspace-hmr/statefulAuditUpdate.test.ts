import { describe, expect, it, vi } from 'vitest'
import { StatefulHmrAuditClient } from './statefulAuditClient'
import { waitForStatefulHmrAuditUpdate } from './statefulAuditUpdate'

describe('stateful HMR audit mutation acknowledgement', () => {
  it('keeps polling after an older batch until the current mutation is emitted', async () => {
    const responses = [
      { type: 'registered' },
      { type: 'batch-published', targetVersion: 1 },
      { type: 'changed' },
      { type: 'batch-published', targetVersion: 2 },
    ]
    const requests: Array<Record<string, unknown>> = []
    const request = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify(responses.shift()), { status: 200 })
    })
    const isCurrentUpdate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const onEvent = vi.fn()
    await waitForStatefulHmrAuditUpdate({
      client: new StatefulHmrAuditClient(request, () => 'audit-session'),
      readControl: async () => ({ buildId: 'build-a', token: 'test-token', url: 'http://localhost/control' }),
      isCurrentUpdate,
      timeoutMs: 1_000,
      onEvent,
    })
    expect(isCurrentUpdate).toHaveBeenCalledTimes(2)
    expect(requests.map(request => [request.action, request.version])).toEqual([
      ['register', 0],
      ['poll', 0],
      ['poll', 1],
      ['poll', 1],
    ])
    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual(['batch-published', 'changed', 'batch-published'])
  })

  it('reports an expired mutation as a failure instead of accepting a transport acknowledgement', async () => {
    vi.useFakeTimers()
    try {
      const request = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'registered' })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'batch-published', targetVersion: 1 })))
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(new Response(JSON.stringify({ type: 'idle' }))), 25)))
      const isCurrentUpdate = vi.fn().mockResolvedValue(false)
      const pending = waitForStatefulHmrAuditUpdate({
        client: new StatefulHmrAuditClient(request),
        readControl: async () => ({ buildId: 'build-a', token: 'test-token', url: 'http://localhost/control' }),
        isCurrentUpdate,
        timeoutMs: 100,
      })
      const rejection = expect(pending).rejects.toThrow('matching the current source mutation')
      await vi.advanceTimersByTimeAsync(150)
      await rejection
      expect(isCurrentUpdate).toHaveBeenCalledOnce()
    }
    finally {
      vi.useRealTimers()
    }
  })
})
