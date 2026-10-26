import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createAutoImportHmrFallback } from '../../packages/weapp-vite/scripts/utils/hmrFallback'
import { StatefulHmrTransport } from '../../packages/weapp-vite/src/runtime/statefulHmr/transport'
import { measureStatefulTemplateArtifact } from './statefulArtifactMeasurement'
import { StatefulHmrAuditClient } from './statefulAuditClient'

const control = { buildId: 'build-a', token: 'test-token', url: 'http://localhost/control' }

async function createRetiredClient() {
  const actions: string[] = []
  let retired = false
  const client = new StatefulHmrAuditClient(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { action: string }
    actions.push(body.action)
    if (body.action === 'register') {
      return new Response(JSON.stringify({ type: 'registered', acknowledgement: 'explicit-v1' }))
    }
    if (retired) {
      throw new Error('retired endpoint was contacted again')
    }
    retired = true
    return new Response(JSON.stringify({ type: 'retired' }))
  })
  await client.ensureRegistered(control, 1_000)
  return { client, actions, hasRetired: () => retired }
}

it('stops polling a retired HTTP host while waiting for classic evidence and the original artifact', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'stateful-retirement-'))
  const pollHeld = Promise.withResolvers<void>()
  const missingEvidence = Promise.withResolvers<void>()
  const readyObserved = Promise.withResolvers<void>()
  const artifact = Promise.withResolvers<number>()
  const cancellation = new AbortController()
  let middleware = async (_request: IncomingMessage, _response: ServerResponse) => {}
  let received = 0
  const server = createServer((request, response) => {
    const index = ++received
    void middleware(request, response).then(() => {
      if (index === 2) {
        pollHeld.resolve()
      }
    }, error => response.destroy(error))
  })
  const transport = new StatefulHmrTransport({
    config: { server: { port: 0 } },
    httpServer: server,
    middlewares: { use: (_route: string, handler: typeof middleware) => { middleware = handler } },
  } as unknown as ViteDevServer, async () => {}, () => {})
  let closing: Promise<void> | undefined
  const closeHost = () => {
    closing ??= new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
      server.closeAllConnections()
    })
    return closing
  }
  let result: Promise<number> | undefined
  let output = ''
  let retired = false
  let observedMissingEvidence = false
  let settled = false
  const actions: string[] = []
  const fallback = createAutoImportHmrFallback(root, () => output)
  try {
    await writeFile(path.join(root, 'app.js'), 'App({})\n')
    await writeFile(path.join(root, 'app.json'), '{}\n')
    transport.install()
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject)
        resolve()
      })
    })
    const control = transport.createControl()
    control.url = control.url.replace('localhost', '127.0.0.1')
    const client = new StatefulHmrAuditClient(async (url, init) => {
      const body = JSON.parse(String(init?.body)) as { action: string }
      actions.push(body.action)
      return fetch(url, init)
    })
    await client.ensureRegistered(control, 1_000)
    result = measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => true,
      measure: async () => artifact.promise,
      signal: cancellation.signal,
      timeoutMs: 1_000,
      onEvent: (event) => {
        if (event.type === 'retired') {
          retired = true
          void closeHost()
        }
      },
      isClassicFallback: async (signal, deadline) => {
        // 首次退役观察固定缺少日志；放行 barrier 也不能改变本次 false。
        if (retired && !observedMissingEvidence) {
          observedMissingEvidence = true
          missingEvidence.resolve()
          return false
        }
        const ready = await fallback.isClassicFallback(signal, deadline)
        if (ready) {
          readyObserved.resolve()
        }
        return ready
      },
    })
    void result.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    await Promise.race([pollHeld.promise, result])
    transport.retire()
    await Promise.race([missingEvidence.promise, result])
    await closeHost()
    expect(settled).toBe(false)
    output = [
      `[weapp-vite] HMR fallback ${JSON.stringify({ from: 'stateful-experimental', to: 'classic', reason: 'native-registration', message: 'registration changed', requested: 'auto', actual: 'classic', phase: 'switching' })}`,
      `[weapp-vite] HMR classic ready ${JSON.stringify({ reason: 'native-registration', requested: 'auto', actual: 'classic', phase: 'classic' })}`,
    ].join('\n')
    await Promise.race([readyObserved.promise, result])
    expect(settled).toBe(false)
    artifact.resolve(17.5)
    await expect(result).resolves.toBe(17.5)
    expect(fallback.evidence).toEqual({ fallbackReason: 'native-registration', classicReadyVerified: true })
    expect(actions).toEqual(['register', 'poll'])
  }
  finally {
    cancellation.abort()
    artifact.resolve(17.5)
    transport.close()
    await Promise.allSettled([result, closeHost()])
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects retirement without a classic fallback validator instead of polling again', async () => {
  const { client, actions } = await createRetiredClient()
  await expect(measureStatefulTemplateArtifact({
    client,
    readControl: async () => control,
    isCurrentUpdate: async () => true,
    measure: async () => 42,
    timeoutMs: 1_000,
  })).rejects.toThrow()
  expect(actions).toEqual(['register', 'poll'])
})

it('requires retirement evidence within the original absolute deadline even when the marker is ready', async () => {
  const { client, actions, hasRetired } = await createRetiredClient()
  const deadline = Date.now() + 50
  const now = vi.spyOn(Date, 'now').mockReturnValue(deadline - 1)
  try {
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => true,
      measure: async () => 42,
      timeoutMs: 1_000,
      deadline,
      isClassicFallback: async (signal, receivedDeadline) => {
        expect(receivedDeadline).toBe(deadline)
        expect(signal.aborted).toBe(false)
        if (hasRetired()) {
          now.mockReturnValue(deadline)
        }
        return false
      },
    })).rejects.toThrow('Timed out consuming')
    expect(actions).toEqual(['register', 'poll'])
  }
  finally {
    now.mockRestore()
  }
})

it('preserves rejection of an unexpected fallback reason after retirement', async () => {
  const { client, actions, hasRetired } = await createRetiredClient()
  const fallback = createAutoImportHmrFallback(tmpdir(), () => hasRetired()
    ? `[weapp-vite] HMR fallback ${JSON.stringify({ from: 'stateful-experimental', to: 'classic', reason: 'runtime-contract', message: 'bridge unavailable', requested: 'auto', actual: 'classic', phase: 'switching' })}`
    : '')
  await expect(measureStatefulTemplateArtifact({
    client,
    readControl: async () => control,
    isCurrentUpdate: async () => true,
    measure: async () => 42,
    timeoutMs: 1_000,
    isClassicFallback: fallback.isClassicFallback,
  })).rejects.toThrow('Unexpected auto-import HMR fallback: runtime-contract')
  expect(actions).toEqual(['register', 'poll'])
})

it('cancels a blocked retirement evidence check and the original marker measurement', async () => {
  const { client, actions, hasRetired } = await createRetiredClient()
  const entered = Promise.withResolvers<void>()
  const evidence = Promise.withResolvers<boolean>()
  const cancellation = new AbortController()
  const failure = new Error('dev process exited during classic handoff')
  let measurementStopped = false
  const result = measureStatefulTemplateArtifact({
    client,
    readControl: async () => control,
    isCurrentUpdate: async () => true,
    timeoutMs: 1_000,
    signal: cancellation.signal,
    measure: async (signal) => {
      try {
        return await new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
      }
      finally {
        measurementStopped = true
      }
    },
    isClassicFallback: async () => {
      if (!hasRetired()) {
        return false
      }
      entered.resolve()
      return evidence.promise
    },
  })
  const rejection = expect(result).rejects.toBe(failure)
  try {
    await Promise.race([entered.promise, result])
    cancellation.abort(failure)
    await rejection
    expect(measurementStopped).toBe(true)
    expect(actions).toEqual(['register', 'poll'])
  }
  finally {
    cancellation.abort(failure)
    evidence.resolve(false)
    await Promise.allSettled([result])
  }
})
