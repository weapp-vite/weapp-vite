import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { createServer } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { NATIVE_BATCH_SETTLEMENT_PREFIX, nativeBatchSettlementPlugin } from './nativeBatchSettlementPlugin'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

async function createBridge() {
  const root = await mkdtemp(path.join(tmpdir(), 'native-batch-settlement-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const input = new PassThrough()
  const output = new PassThrough()
  const called = Promise.withResolvers<void>()
  const settled = Promise.withResolvers<void>()
  const whenSettled = vi.fn(() => {
    called.resolve()
    return settled.promise
  })
  const before = input.listenerCount('data')
  const server = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    plugins: [
      { name: 'weapp-vite:stateful-hmr-session', api: { whenSettled } },
      nativeBatchSettlementPlugin({ input, output }),
    ],
    server: { middlewareMode: true, watch: null, hmr: false },
  })
  cleanups.push(async () => {
    await server.close()
    input.destroy()
    output.destroy()
  })
  const responses: string[] = []
  output.on('data', chunk => responses.push(String(chunk)))
  const request = (id: string) => input.write(`${NATIVE_BATCH_SETTLEMENT_PREFIX}${JSON.stringify({ id })}\n`)
  return { input, output, called, settled, whenSettled, before, server, responses, request }
}

it('does not acknowledge an active owner and carries the request identity only after settlement', async () => {
  const bridge = await createBridge()
  bridge.request('restoration-generation')
  await bridge.called.promise
  expect(bridge.whenSettled).toHaveBeenCalledTimes(1)
  expect(bridge.responses).toEqual([])
  const response = once(bridge.output, 'data')
  bridge.settled.resolve()
  await response
  expect(bridge.responses).toEqual([`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"id":"restoration-generation","status":"complete"}\n`])
})

it('reports an owner rejection as failed rather than acknowledging readable output', async () => {
  const bridge = await createBridge()
  bridge.request('failed-publication')
  await bridge.called.promise
  const response = once(bridge.output, 'data')
  bridge.settled.reject(new Error('publication cleanup failed'))
  await response
  expect(bridge.responses).toEqual([`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"id":"failed-publication","status":"failed","error":"publication cleanup failed"}\n`])
})

it('removes input listeners on host close and cannot emit a late success for that host', async () => {
  const bridge = await createBridge()
  bridge.request('closing-generation')
  await bridge.called.promise
  await bridge.server.close()
  expect(bridge.input.listenerCount('data')).toBe(bridge.before)
  bridge.request('next-generation')
  expect(bridge.whenSettled).toHaveBeenCalledTimes(1)
  const response = once(bridge.output, 'data')
  bridge.settled.resolve()
  await response
  expect(bridge.responses).toEqual([`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"id":"closing-generation","status":"failed","error":"Native batch settlement observer closed before acknowledgement"}\n`])
  await bridge.server.close()
  expect(bridge.input.listenerCount('data')).toBe(bridge.before)
})

it('does not invoke the owner for malformed fixture requests', async () => {
  const bridge = await createBridge()
  const response = once(bridge.output, 'data')
  bridge.input.write(`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"id":42}\n`)
  await response
  expect(bridge.whenSettled).not.toHaveBeenCalled()
  expect(bridge.responses).toEqual([`${NATIVE_BATCH_SETTLEMENT_PREFIX}{"status":"failed","error":"Invalid native batch settlement request"}\n`])
})
