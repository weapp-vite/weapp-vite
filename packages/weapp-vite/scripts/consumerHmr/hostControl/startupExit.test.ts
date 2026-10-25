import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { setImmediate } from 'node:timers/promises'
import { afterEach, expect, it } from 'vitest'
import { createNativeHostControl } from './index.mjs'

interface NativeExit {
  exitCode: number | undefined
  signal: string | undefined
}

type EventOrder = 'channel-first' | 'exit-first'

const fixtures: Array<{ root: string, control: Awaited<ReturnType<typeof createNativeHostControl>> }> = []

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.control.dispose()
    await rm(fixture.root, { recursive: true, force: true })
  }
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-startup-exit-'))
  await writeFile(path.join(root, 'original.config.mjs'), 'export default {}\n')
  const control = await createNativeHostControl(root, 'original.config.mjs')
  fixtures.push({ root, control })
  const source = await readFile(control.configFile, 'utf8')
  const serialized = source.match(/createNativeHostControlPlugin\((\{[^{}\r\n]*\})\)/)?.[1]
  expect(serialized).toBeDefined()
  const endpoint = JSON.parse(serialized!) as { port: number, token: string }
  return { control, endpoint }
}

async function connectedFixture() {
  const current = await fixture()
  const socket = connect({ host: '127.0.0.1', port: current.endpoint.port })
  const requested = Promise.withResolvers<void>()
  const closed = Promise.withResolvers<void>()
  socket.on('error', error => requested.reject(error))
  socket.once('close', () => closed.resolve())
  const input = createInterface({ input: socket })
  input.on('line', (line) => {
    const message = JSON.parse(line) as { type: string, token: string }
    if (message.type === 'close' && message.token === current.endpoint.token) {
      requested.resolve()
    }
  })
  const send = (message: { type: string, error?: string }) => socket.write(`${JSON.stringify({ ...message, token: current.endpoint.token })}\n`)
  socket.once('connect', () => send({ type: 'ready' }))
  const exited = Promise.withResolvers<NativeExit>()
  const stopping = current.control.requestClose(exited.promise)
  const outcome = stopping.then(value => ({ status: 'fulfilled' as const, value }), (error: unknown) => ({ status: 'rejected' as const, error }))
  await requested.promise
  return { ...current, socket, send, exited, stopping, outcome, closed: closed.promise }
}

async function finishWithoutReceipt(current: Awaited<ReturnType<typeof connectedFixture>>, order: EventOrder, exit: NativeExit) {
  if (order === 'exit-first') {
    current.exited.resolve(exit)
    // 只推进已排队的通知，不以固定延迟推断控制通道是否仍有消息。
    await setImmediate()
  }
  current.socket.end()
  await current.closed
  if (order === 'channel-first') {
    current.exited.resolve(exit)
  }
}

it.each(['channel-first', 'exit-first'] as const)('preserves a confirmed startup failure independently of %s notification order', async (order) => {
  const current = await connectedFixture()
  let finished = false
  void current.outcome.then(() => finished = true)
  if (order === 'channel-first') {
    current.socket.end()
    await current.closed
  }
  else {
    current.exited.resolve({ exitCode: 1, signal: undefined })
    await setImmediate()
  }
  expect(finished, 'both authenticated channel termination and fully drained failure are required').toBe(false)
  if (order === 'channel-first') {
    current.exited.resolve({ exitCode: 1, signal: undefined })
  }
  else {
    current.socket.end()
    await current.closed
  }
  expect(await current.outcome).toEqual({ status: 'fulfilled', value: { type: 'startup-exited' } })
  expect(current.control.requestClose(current.exited.promise)).toBe(current.stopping)
})

it.each([
  { order: 'channel-first', exitCode: 0 },
  { order: 'exit-first', exitCode: 0 },
  { order: 'channel-first', exitCode: 1 },
  { order: 'exit-first', exitCode: 1 },
] as const)('rejects a running host without a receipt after $order and exit=$exitCode', async ({ order, exitCode }) => {
  const current = await connectedFixture()
  // 同一 TCP 流上的启动消息必须在 EOF 仲裁前被处理，即使原生退出先到达。
  current.send({ type: 'initial-started' })
  await finishWithoutReceipt(current, order, { exitCode, signal: undefined })
  expect(await current.outcome).toMatchObject({ status: 'rejected', error: { message: expect.stringContaining('disconnected before its cleanup receipt') } })
})

it.each(['channel-first', 'exit-first'] as const)('rejects a successful startup exit without a receipt after %s', async (order) => {
  const current = await connectedFixture()
  await finishWithoutReceipt(current, order, { exitCode: 0, signal: undefined })
  expect(await current.outcome).toMatchObject({ status: 'rejected', error: { message: expect.stringContaining('disconnected before its cleanup receipt') } })
})

it.each(['channel-first', 'exit-first'] as const)('does not downgrade an explicit cleanup failure receipt after %s', async (order) => {
  const current = await connectedFixture()
  if (order === 'exit-first') {
    current.exited.resolve({ exitCode: 1, signal: undefined })
    await setImmediate()
  }
  current.send({ type: 'closed', error: 'original-native-close-failure' })
  current.socket.end()
  await current.closed
  if (order === 'channel-first') {
    current.exited.resolve({ exitCode: 1, signal: undefined })
  }
  expect(await current.outcome).toMatchObject({ status: 'rejected', error: { message: 'Native host cleanup failed: original-native-close-failure' } })
})

it.each(['channel-first', 'exit-first'] as const)('rejects a signalled startup exit without a receipt after %s', async (order) => {
  const current = await connectedFixture()
  await finishWithoutReceipt(current, order, { exitCode: 1, signal: 'SIGTERM' })
  expect(await current.outcome).toMatchObject({ status: 'rejected', error: { message: expect.stringContaining('disconnected before its cleanup receipt') } })
})

it('does not infer a startup failure from an exit without an authenticated peer', async () => {
  const current = await fixture()
  const stopping = current.control.requestClose(Promise.resolve({ exitCode: 1, signal: undefined }))
  let finished = false
  const outcome = stopping.catch((error: unknown) => error).finally(() => finished = true)
  await setImmediate()
  expect(finished).toBe(false)
  await current.control.dispose()
  expect(await outcome).toMatchObject({ message: 'Native host control disposed before its cleanup receipt' })
})
