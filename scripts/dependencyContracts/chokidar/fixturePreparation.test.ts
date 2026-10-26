import { EventEmitter } from 'node:events'
import path from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { prepareInitialFile } from './fixturePreparation.mjs'

const io = vi.hoisted(() => ({ watch: vi.fn(), writeFile: vi.fn() }))
vi.mock('node:fs', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs')>(),
  default: { ...await importOriginal<typeof import('node:fs')>(), watch: io.watch },
}))
vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  writeFile: io.writeFile,
}))

function fixture() {
  const file = path.resolve('initial-fixture', 'preexisting.txt')
  const native = Object.assign(new EventEmitter(), { close: vi.fn() })
  const closed = Promise.withResolvers<void>()
  const events: { phase: string }[] = []
  const instrumentation = { settleDirectoryRegistration: vi.fn().mockResolvedValue(undefined), assertAllClosed: vi.fn(() => closed.promise) }
  let notify: (event: string, filename: string | null) => void
  io.watch.mockImplementation((_directory, listener) => {
    notify = listener
    return native
  })
  const run = () => prepareInitialFile({ file, value: 'initial value', timeoutMs: 1000, instrumentation, record: (entry: { phase: string }) => events.push(entry) })
  return { file, native, closed, events, instrumentation, notify: (event: string, filename: string | null) => notify(event, filename), run }
}

beforeEach(() => {
  vi.resetAllMocks()
  io.writeFile.mockResolvedValue(undefined)
})

it('requires the exact creation notification and actual native close before completing preparation', async () => {
  const ctx = fixture()
  const registered = Promise.withResolvers<void>()
  ctx.instrumentation.settleDirectoryRegistration.mockReturnValue(registered.promise)
  const result = ctx.run()
  let completed = false
  void result.then(() => {
    completed = true
  }, () => {})
  expect(io.writeFile).not.toHaveBeenCalled()
  registered.resolve()
  ctx.notify('rename', 'another-file.txt')
  ctx.notify('change', 'preexisting.txt')
  ctx.notify('rename', null)
  await new Promise(resolve => setImmediate(resolve))
  expect(io.watch).toHaveBeenCalledWith(path.dirname(ctx.file), expect.any(Function))
  expect(io.writeFile).toHaveBeenCalledExactlyOnceWith(ctx.file, 'initial value')
  expect(ctx.native.close).not.toHaveBeenCalled()
  ctx.notify('rename', 'preexisting.txt')
  await new Promise(resolve => setImmediate(resolve))
  expect(ctx.native.close).toHaveBeenCalledOnce()
  expect(completed).toBe(false)
  expect(ctx.events.map(event => event.phase)).not.toContain('preparation-native-close-confirmed')
  ctx.closed.resolve()
  await result
  expect(ctx.events.map(event => event.phase)).toEqual(['preparation-watcher-started', 'preparation-native-registration-confirmed', 'initial-file-written', 'initial-file-native-create', 'preparation-native-close-confirmed'])
})

it('closes the acquired watcher and preserves a write failure', async () => {
  const ctx = fixture()
  const original = new Error('initial write failed')
  io.writeFile.mockRejectedValue(original)
  const result = ctx.run().catch((error: unknown) => error)
  await new Promise(resolve => setImmediate(resolve))
  expect(ctx.native.close).toHaveBeenCalledOnce()
  ctx.closed.resolve()
  expect(await result).toBe(original)
})

it('preserves both preparation and native cleanup failures', async () => {
  const ctx = fixture()
  const original = new Error('initial write failed')
  const cleanup = new Error('native close is unconfirmed')
  io.writeFile.mockRejectedValue(original)
  ctx.instrumentation.assertAllClosed.mockRejectedValue(cleanup)
  const result = await ctx.run().catch((error: unknown) => error)
  expect(result).toBeInstanceOf(AggregateError)
  expect((result as AggregateError).errors).toEqual([original, cleanup])
  expect((result as AggregateError).cause).toBe(original)
})

it('does not write the fixture when acquiring its preparation watcher fails', async () => {
  const ctx = fixture()
  const original = new Error('native watch failed')
  io.watch.mockImplementation(() => {
    throw original
  })
  expect(await ctx.run().catch((error: unknown) => error)).toBe(original)
  expect(io.writeFile).not.toHaveBeenCalled()
  expect(ctx.instrumentation.assertAllClosed).not.toHaveBeenCalled()
})

it('keeps a native notification error and still confirms the exact close', async () => {
  const ctx = fixture()
  const original = new Error('native preparation notification failed')
  const result = ctx.run().catch((error: unknown) => error)
  ctx.native.emit('error', original)
  await new Promise(resolve => setImmediate(resolve))
  expect(ctx.native.close).toHaveBeenCalledOnce()
  ctx.closed.resolve()
  expect(await result).toBe(original)
})
