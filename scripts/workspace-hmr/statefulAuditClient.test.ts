import { describe, expect, it, vi } from 'vitest'
import { StatefulHmrAuditClient } from './statefulAuditClient'

describe('StatefulHmrAuditClient', () => {
  it('explicitly confirms validated artifacts only when the server supports it', async () => {
    const requests: Array<Record<string, unknown>> = []
    const request = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      requests.push(body)
      const response = body.action === 'register'
        ? { type: 'registered', acknowledgement: 'explicit-v1' }
        : body.action === 'ack'
          ? { type: 'acknowledged', version: body.version }
          : { type: 'batch-published', targetVersion: 1 }
      return new Response(JSON.stringify(response))
    })
    const client = new StatefulHmrAuditClient(request, () => 'audit-session')
    await client.ensureRegistered({ buildId: 'build', token: 'token', url: 'http://localhost/control' }, 1_000)
    await client.poll(1_000)
    expect(requests.map(item => item.action)).toEqual(['register', 'poll'])
    await client.acknowledgePublished(1_000)
    expect(requests.at(-1)).toMatchObject({ action: 'ack', version: 1 })

    const legacyRequest = vi.fn(async () => new Response(JSON.stringify({ type: 'registered' })))
    const legacy = new StatefulHmrAuditClient(legacyRequest)
    await legacy.ensureRegistered({ buildId: 'baseline', token: 'token', url: 'http://localhost/control' }, 1_000)
    await legacy.acknowledgePublished(1_000)
    expect(legacyRequest).toHaveBeenCalledOnce()
  })

  it('reuses one session and advances the version between published batches', async () => {
    const responses = [
      { type: 'registered' },
      { type: 'batch-published', targetVersion: 1 },
      { type: 'batch-published', targetVersion: 2 },
    ]
    const requests: Array<Record<string, unknown>> = []
    const request = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify(responses.shift()), { status: 200 })
    })
    const client = new StatefulHmrAuditClient(request, () => 'audit-session')
    const control = {
      buildId: 'build-a',
      token: 'token-a',
      url: 'http://127.0.0.1:1234/__weapp_vite_hmr',
    }

    await client.ensureRegistered(control, 1_000)
    await client.poll(1_000)
    await client.ensureRegistered(control, 1_000)
    await client.poll(1_000)

    expect(request).toHaveBeenCalledTimes(3)
    expect(requests).toEqual([
      expect.objectContaining({ action: 'register', sessionId: 'audit-session', version: 0 }),
      expect.objectContaining({ action: 'poll', sessionId: 'audit-session', version: 0 }),
      expect.objectContaining({ action: 'poll', sessionId: 'audit-session', version: 1 }),
    ])
  })

  it('resets registration and version when the server control changes', async () => {
    const responses = [
      { type: 'registered' },
      { type: 'batch-published', targetVersion: 3 },
      { type: 'registered' },
      { type: 'batch-published', targetVersion: 1 },
    ]
    const requests: Array<Record<string, unknown>> = []
    const request = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify(responses.shift()), { status: 200 })
    })
    const client = new StatefulHmrAuditClient(request, () => 'audit-session')

    await client.ensureRegistered({ buildId: 'build-a', token: 'a', url: 'http://localhost/a' }, 1_000)
    await client.poll(1_000)
    await client.ensureRegistered({ buildId: 'build-b', token: 'b', url: 'http://localhost/b' }, 1_000)
    await client.poll(1_000)

    expect(requests).toEqual([
      expect.objectContaining({ action: 'register', buildId: 'build-a', version: 0 }),
      expect.objectContaining({ action: 'poll', buildId: 'build-a', version: 0 }),
      expect.objectContaining({ action: 'register', buildId: 'build-b', version: 0 }),
      expect.objectContaining({ action: 'poll', buildId: 'build-b', version: 0 }),
    ])
  })

  it('does not advance the version when a cancelled request responds late', async () => {
    const response = Promise.withResolvers<Response>()
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'registered', acknowledgement: 'explicit-v1' })))
      .mockImplementationOnce(() => response.promise)
    const client = new StatefulHmrAuditClient(request)
    await client.ensureRegistered({ buildId: 'build', token: 'token', url: 'http://localhost/control' }, 1_000)
    const cancellation = new AbortController()
    const failure = new Error('cancelled measurement')
    const pending = client.poll(1_000, cancellation.signal)
    const rejection = expect(pending).rejects.toBe(failure)
    cancellation.abort(failure)
    response.resolve(new Response(JSON.stringify({ type: 'batch-published', targetVersion: 9 })))
    await rejection
    expect(client.acknowledgedVersion).toBe(0)
  })
})
