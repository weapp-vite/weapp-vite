import path from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { recreateAndExercise } from './registration.mjs'

const io = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
}))
const phases = vi.hoisted(() => ({ drain: vi.fn() }))

vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  ...io,
}))
vi.mock('./support.mjs', async importOriginal => ({
  ...await importOriginal<typeof import('./support.mjs')>(),
  waitForObservedEventPhase: phases.drain,
}))

function fixture() {
  const root = path.resolve('recreated-directory-fixture')
  const registered = Promise.withResolvers<void>()
  void registered.promise.catch(() => {})
  const owner = { errors: [], event: vi.fn().mockResolvedValue(undefined) }
  const context = {
    target: path.join(root, 'src', 'extra'),
    image: path.join(root, 'src', 'extra', 'image.txt'),
    timeoutMs: 1000,
    scenarioEvidence: [],
    instrumentation: {
      settleDirectoryRegistration: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockImplementationOnce(() => registered.promise),
    },
  }
  const run = () => recreateAndExercise(owner, context).catch((error: unknown) => error)
  return { registered, owner, context, run }
}

beforeEach(() => {
  vi.resetAllMocks()
  io.mkdir.mockResolvedValue(undefined)
  io.writeFile.mockResolvedValue(undefined)
  io.readFile.mockResolvedValueOnce('recreated image').mockResolvedValueOnce('changed recreated image with a different size')
  phases.drain.mockResolvedValue(undefined)
})

it('waits for the recreated directory subscription after add before later changes or removal', async () => {
  const ctx = fixture()
  const original = new Error('stop after the owned removal')
  io.rm.mockRejectedValue(original)
  const result = ctx.run()
  try {
    await new Promise(resolve => setImmediate(resolve))
    expect(ctx.context.instrumentation.settleDirectoryRegistration).toHaveBeenCalledTimes(2)
    expect(io.writeFile).toHaveBeenCalledExactlyOnceWith(ctx.context.image, 'recreated image')
    expect(io.rm, 'the earlier parent barrier cannot prove readiness of the newly registered child').not.toHaveBeenCalled()
  }
  finally { ctx.registered.resolve() }
  expect(await result).toBe(original)
  expect(io.writeFile).toHaveBeenCalledTimes(2)
  expect(io.rm).toHaveBeenCalledExactlyOnceWith(ctx.context.image)
})

it('preserves a recreated directory registration error without performing follow-up mutations', async () => {
  const ctx = fixture()
  const original = new Error('new directory native registration failed')
  const unexpected = new Error('follow-up removal must not happen')
  io.rm.mockRejectedValue(unexpected)
  const result = ctx.run()
  await new Promise(resolve => setImmediate(resolve))
  ctx.registered.reject(original)
  expect(await result).toBe(original)
  expect(io.writeFile).toHaveBeenCalledOnce()
  expect(io.rm).not.toHaveBeenCalled()
})
