import { describe, expect, it, vi } from 'vitest'
import { measureStatefulTemplateArtifact } from './statefulArtifactMeasurement'
import { StatefulHmrAuditClient } from './statefulAuditClient'

const control = { buildId: 'diagnostic-build', token: 'test-token', url: 'http://localhost/control' }

describe('template acknowledgement observation', () => {
  it.each([false, true])('observes actual acknowledgement completion without changing the marker result, failure=%s', async (fail) => {
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const failure = new Error('acknowledgement failed')
    const client = new StatefulHmrAuditClient(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as { action: string, version: number }
      if (request.action === 'register') {
        return new Response(JSON.stringify({ type: 'registered', acknowledgement: 'explicit-v1' }))
      }
      if (request.action === 'poll') {
        return new Response(JSON.stringify({ type: 'batch-published', targetVersion: 1 }))
      }
      entered.resolve()
      await release.promise
      if (fail) {
        throw failure
      }
      return new Response(JSON.stringify({ type: 'acknowledged', version: request.version }))
    })
    await client.ensureRegistered(control, 1_000)
    const observed = vi.fn()
    const measurement = measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => true,
      measure: async () => 12.5,
      timeoutMs: 1_000,
      onAcknowledgement: observed,
    })
    const result = fail ? expect(measurement).rejects.toBe(failure) : expect(measurement).resolves.toBe(12.5)
    try {
      await entered.promise
      expect(observed.mock.calls).toEqual([[{ phase: 'start', buildId: control.buildId, targetVersion: 1 }]])
    }
    finally {
      release.resolve()
      await result
    }
    expect(observed.mock.calls).toEqual([
      [{ phase: 'start', buildId: control.buildId, targetVersion: 1 }],
      ...fail ? [] : [[{ phase: 'complete', buildId: control.buildId, targetVersion: 1 }]],
    ])
  })

  it('does not fabricate acknowledgement events for a legacy host', async () => {
    const observed = vi.fn()
    const client = new StatefulHmrAuditClient(async () => new Response(JSON.stringify({ type: 'registered' })))
    await client.ensureRegistered(control, 1_000)
    expect(await measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => true,
      measure: async () => 18.5,
      timeoutMs: 1_000,
      onAcknowledgement: observed,
    })).toBe(18.5)
    expect(observed).not.toHaveBeenCalled()
  })
})
