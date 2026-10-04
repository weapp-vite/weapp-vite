import { performance } from 'node:perf_hooks'
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

async function createClient(request: typeof fetch) {
  const client = new StatefulHmrAuditClient(async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { action: string }
    return body.action === 'register'
      ? new Response(JSON.stringify({ type: 'registered', acknowledgement: 'explicit-v1' }))
      : request(url, init)
  })
  await client.ensureRegistered(control, 1_000)
  return { client }
}

describe('stateful artifact deadline ownership', () => {
  it.each(['poll', 'missing-control'] as const)('recognizes its deadline during %s independently of the performance clock', async (blocked) => {
    const failure = new Error('original emitted marker timeout')
    const { client } = await createClient(async (_url, init) => untilAborted(init?.signal))
    // 模拟毫秒计时器先触发、高精度时钟尚未跨过截止点的合法调度顺序。
    const now = vi.spyOn(performance, 'now').mockReturnValue(100)
    try {
      await expect(measureStatefulTemplateArtifact({
        client,
        readControl: async () => {
          if (blocked === 'missing-control') {
            throw Object.assign(new Error('control being replaced'), { code: 'ENOENT' })
          }
          return control
        },
        isCurrentUpdate: async () => false,
        measure: async () => {
          await sleep(40)
          throw failure
        },
        timeoutMs: 20,
      })).rejects.toBe(failure)
    }
    finally {
      now.mockRestore()
    }
  })

  it('preserves an independent transport error even when the performance clock crosses the deadline', async () => {
    const failure = new Error('independent transport failure')
    const now = vi.spyOn(performance, 'now').mockReturnValue(100)
    try {
      const { client } = await createClient(async () => {
        now.mockReturnValue(2_000)
        throw failure
      })
      await expect(measureStatefulTemplateArtifact({
        client,
        readControl: async () => control,
        isCurrentUpdate: async () => false,
        measure: async () => 17,
        timeoutMs: 1_000,
      })).rejects.toBe(failure)
    }
    finally {
      now.mockRestore()
    }
  })
})
