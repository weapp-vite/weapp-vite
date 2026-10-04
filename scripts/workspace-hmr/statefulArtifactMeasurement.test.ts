import { setTimeout as sleep } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import { measureStatefulTemplateArtifact } from './statefulArtifactMeasurement'
import { StatefulHmrAuditClient } from './statefulAuditClient'

const control = { buildId: 'build-a', token: 'test-token', url: 'http://localhost/control' }

function untilAborted(signal?: AbortSignal | null): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
    }
    else {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    }
  })
}

async function createClient(request: typeof fetch, explicit: boolean | ((buildId: string) => boolean) = true) {
  const requests: Array<{ action: string, version: number, buildId: string }> = []
  const client = new StatefulHmrAuditClient(async (url, init) => {
    const body = JSON.parse(String(init?.body)) as typeof requests[number]
    requests.push(body)
    if (body.action === 'register') {
      const supported = typeof explicit === 'function' ? explicit(body.buildId) : explicit
      return new Response(JSON.stringify({ type: 'registered', acknowledgement: supported ? 'explicit-v1' : undefined }))
    }
    return request(url, init)
  })
  await client.ensureRegistered(control, 1_000)
  return { client, requests }
}

describe('concurrent template artifact consumption', () => {
  it('preserves the marker measurement instead of including acknowledgement latency', async () => {
    const acknowledge = Promise.withResolvers<void>()
    const acknowledging = Promise.withResolvers<void>()
    const { client, requests } = await createClient(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { action: string, version: number }
      if (body.action === 'ack') {
        acknowledging.resolve()
        await acknowledge.promise
        return new Response(JSON.stringify({ type: 'acknowledged', version: body.version }))
      }
      return new Response(JSON.stringify({ type: 'batch-published', targetVersion: 1 }))
    })
    const result = measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => true,
      measure: async () => 17.5,
      timeoutMs: 1_000,
    })
    await acknowledging.promise
    acknowledge.resolve()
    expect(await result).toBe(17.5)
    expect(requests.map(item => `${item.action}:${item.version}`)).toEqual(['register:0', 'poll:0', 'ack:1'])
  })

  it('keeps legacy and non-stateful runs on their original artifact measurement', async () => {
    const request = vi.fn()
    const { client } = await createClient(request, false)
    const isCurrentUpdate = vi.fn()
    const readControl = vi.fn()
    for (const candidate of [client, undefined]) {
      expect(await measureStatefulTemplateArtifact({
        client: candidate,
        readControl,
        isCurrentUpdate,
        measure: async () => 23,
        timeoutMs: 1_000,
      })).toBe(23)
    }
    expect(request).not.toHaveBeenCalled()
    expect(readControl).not.toHaveBeenCalled()
    expect(isCurrentUpdate).not.toHaveBeenCalled()
  })

  it('does not accept an acknowledged older batch without the target marker and stops its poll', async () => {
    let activePolls = 0
    const { client, requests } = await createClient(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { action: string, version: number }
      if (body.action === 'ack') {
        return new Response(JSON.stringify({ type: 'acknowledged', version: body.version }))
      }
      if (body.version === 0) {
        return new Response(JSON.stringify({ type: 'batch-published', targetVersion: 1 }))
      }
      activePolls += 1
      try {
        return await untilAborted(init?.signal)
      }
      finally {
        activePolls -= 1
      }
    })
    const failure = new Error('original emitted marker timeout')
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => false,
      measure: async () => {
        await sleep(20)
        throw failure
      },
      timeoutMs: 1_000,
    })).rejects.toBe(failure)
    expect(requests.map(item => item.action)).toEqual(['register', 'poll', 'ack', 'poll'])
    expect(activePolls).toBe(0)
  })

  it('preserves a client failure and aborts the in-progress artifact measurement', async () => {
    const failure = new Error('transport failed')
    const { client } = await createClient(async () => {
      throw failure
    })
    let stopped = false
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => false,
      measure: async (signal) => {
        try {
          return await untilAborted(signal)
        }
        finally {
          stopped = true
        }
      },
      timeoutMs: 1_000,
    })).rejects.toBe(failure)
    expect(stopped).toBe(true)
  })

  it.each(['control', 'artifact', 'poll'] as const)('cancels a blocked %s read without retaining the consumer', async (blocked) => {
    const entered = Promise.withResolvers<void>()
    const cancellation = new AbortController()
    const failure = new Error('dev process exited')
    const block = () => {
      entered.resolve()
      return new Promise<never>(() => {})
    }
    const { client } = await createClient(async () => blocked === 'poll'
      ? block()
      : new Response(JSON.stringify({ type: 'batch-published', targetVersion: 1 })))
    let measurementStopped = false
    const result = measureStatefulTemplateArtifact({
      client,
      readControl: async () => blocked === 'control' ? block() : control,
      isCurrentUpdate: async () => blocked === 'artifact' ? block() : false,
      signal: cancellation.signal,
      measure: async (signal) => {
        try {
          return await untilAborted(signal)
        }
        finally {
          measurementStopped = true
        }
      },
      timeoutMs: 1_000,
    })
    const rejection = expect(result).rejects.toBe(failure)
    await entered.promise
    cancellation.abort(failure)
    await rejection
    expect(measurementStopped).toBe(true)
  })

  it('re-registers after a build change instead of acknowledging an old batch for new output', async () => {
    let current = control
    const { client, requests } = await createClient(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { action: string, version: number }
      return new Response(JSON.stringify(body.action === 'ack'
        ? { type: 'acknowledged', version: body.version }
        : { type: 'batch-published', targetVersion: 1 }))
    })
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => current,
      isCurrentUpdate: async () => {
        current = { ...control, buildId: 'build-b' }
        return true
      },
      measure: async () => 31,
      timeoutMs: 1_000,
    })).resolves.toBe(31)
    expect(requests.map(item => `${item.buildId}:${item.action}:${item.version}`)).toEqual([
      'build-a:register:0',
      'build-a:poll:0',
      'build-b:register:0',
      'build-b:poll:0',
      'build-b:ack:1',
    ])
  })

  it('retains the original marker timeout when the consumer deadline expires first', async () => {
    const failure = new Error('original emitted marker timeout')
    const { client } = await createClient(async (_url, init) => untilAborted(init?.signal))
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => false,
      measure: async () => {
        await sleep(40)
        throw failure
      },
      timeoutMs: 20,
    })).rejects.toBe(failure)
  })

  it('keeps the artifact assertion when a rebuilt host no longer supports explicit acknowledgement', async () => {
    const request = vi.fn()
    const { client, requests } = await createClient(request, buildId => buildId === control.buildId)
    const failure = new Error('rebuilt output does not contain the marker')
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => ({ ...control, buildId: 'legacy-build' }),
      isCurrentUpdate: vi.fn(),
      measure: async () => {
        await sleep(1)
        throw failure
      },
      timeoutMs: 1_000,
    })).rejects.toBe(failure)
    expect(request).not.toHaveBeenCalled()
    expect(requests.map(item => `${item.buildId}:${item.action}`)).toEqual(['build-a:register', 'legacy-build:register'])
  })

  it('treats temporary missing control and output as unready, then consumes the matching batch', async () => {
    const missing = Object.assign(new Error('file being replaced'), { code: 'ENOENT' })
    const { client, requests } = await createClient(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { action: string, version: number }
      return new Response(JSON.stringify(body.action === 'ack'
        ? { type: 'acknowledged', version: body.version }
        : { type: 'batch-published', targetVersion: body.version + 1 }))
    })
    const readControl = vi.fn().mockRejectedValueOnce(missing).mockResolvedValue(control)
    const isCurrentUpdate = vi.fn().mockRejectedValueOnce(missing).mockResolvedValue(true)
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl,
      isCurrentUpdate,
      measure: async () => 37,
      timeoutMs: 1_000,
    })).resolves.toBe(37)
    expect(requests.map(item => `${item.action}:${item.version}`)).toEqual(['register:0', 'poll:0', 'ack:1', 'poll:1', 'ack:2'])
  })

  it('preserves malformed control errors and rejects a previously consumed batch', async () => {
    const failure = new SyntaxError('invalid control source')
    const request = vi.fn(async () => new Response(JSON.stringify({ type: 'batch-published', targetVersion: 0 })))
    const { client } = await createClient(request)
    const options = { client, isCurrentUpdate: async () => true, measure: async () => 11, timeoutMs: 1_000 }
    await expect(measureStatefulTemplateArtifact({ ...options, readControl: async () => {
      throw failure
    } })).rejects.toBe(failure)
    expect(request).not.toHaveBeenCalled()
    await expect(measureStatefulTemplateArtifact({ ...options, readControl: async () => control }))
      .rejects
      .toThrow('newly published batch version')
  })

  it('retains the pending batch while control is temporarily missing before acknowledgement', async () => {
    const missing = Object.assign(new Error('control being replaced'), { code: 'ENOENT' })
    const { client, requests } = await createClient(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { action: string, version: number }
      return new Response(JSON.stringify(body.action === 'ack'
        ? { type: 'acknowledged', version: body.version }
        : { type: 'batch-published', targetVersion: 1 }))
    })
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: vi.fn().mockResolvedValueOnce(control).mockRejectedValueOnce(missing).mockResolvedValue(control),
      isCurrentUpdate: async () => true,
      measure: async () => 41,
      timeoutMs: 1_000,
    })).resolves.toBe(41)
    expect(requests.map(item => `${item.action}:${item.version}`)).toEqual(['register:0', 'poll:0', 'ack:1'])
  })
})
