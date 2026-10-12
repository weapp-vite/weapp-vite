import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation } from '../../types/compilerPlugin'
import { HmrCompilerHost, HmrDeliveryCoordinator } from '@weapp-vite/hmr'
import { expect, it, vi } from 'vitest'
import { compileHmrBatch } from './compileBatch'

function rejectDisposal(kind: 'sync' | 'async', failure: Error) {
  return kind === 'sync'
    ? vi.fn(() => { throw failure })
    : vi.fn(async () => { throw failure })
}

function compile(preparations: WeappCompilerHmrPreparation[], compileFailure?: Error) {
  return compileHmrBatch({
    ctx: {} as CompilerContext,
    input: { revision: 1, changedFiles: [], sources: new Map() },
    needsSnapshot: Boolean(compileFailure),
    patches: [],
    prepareProviders: async () => preparations,
    rebuild: async () => {
      if (compileFailure) {
        throw compileFailure
      }
      return { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() }
    },
    sourcemap: false,
  })
}

it.each(['sync', 'async'] as const)('reports a %s provider disposal failure and still releases later preparations', async (kind) => {
  const failure = new Error(`${kind} preparation disposal failed`)
  const first = rejectDisposal(kind, failure)
  const last = vi.fn()
  const compiled = await compile([{ dispose: first }, { dispose: last }])
  await expect(compiled.dispose()).rejects.toBe(failure)
  await expect(compiled.dispose()).rejects.toBe(failure)
  expect(first).toHaveBeenCalledOnce()
  expect(last).toHaveBeenCalledOnce()
})

it.each(['sync', 'async'] as const)('retains compilation as the first error alongside %s disposal failure', async (kind) => {
  const original = new Error('snapshot compilation failed')
  const cleanup = new Error(`${kind} preparation disposal failed`)
  const first = rejectDisposal(kind, cleanup)
  const last = vi.fn()
  await expect(compile([{ dispose: first }, { dispose: last }], original)).rejects.toMatchObject({
    cause: original,
    errors: [original, cleanup],
  })
  expect(first).toHaveBeenCalledOnce()
  expect(last).toHaveBeenCalledOnce()
})

it('shares concurrent disposal and waits for every disposer before preserving all errors in provider order', async () => {
  const first = new Error('first disposal failed')
  const last = new Error('last disposal failed')
  const disposing = Promise.withResolvers<void>()
  const disposed = Promise.withResolvers<void>()
  const delayed = vi.fn(async () => {
    disposing.resolve()
    await disposed.promise
    throw last
  })
  const compiled = await compile([
    { dispose: () => { throw first } },
    { dispose: delayed },
  ])
  const disposal = compiled.dispose()
  expect(compiled.dispose()).toBe(disposal)
  let settled = false
  const waiting = disposal.catch((error) => {
    settled = true
    return error
  })
  await disposing.promise
  expect(settled).toBe(false)
  disposed.resolve()
  const error = await waiting
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual([first, last])
  expect(error.cause).toBe(first)
  expect(delayed).toHaveBeenCalledOnce()
})

it('keeps the original compilation error identity when all cleanup succeeds', async () => {
  const original = new Error('snapshot compilation failed')
  const dispose = vi.fn()
  await expect(compile([{ dispose }], original)).rejects.toBe(original)
  expect(dispose).toHaveBeenCalledOnce()
})

it('preserves each provider cleanup error behind the compilation error', async () => {
  const original = new Error('snapshot compilation failed')
  const first = new Error('first disposal failed')
  const last = new Error('last disposal failed')
  await expect(compile([
    { dispose: () => { throw first } },
    { dispose: async () => { throw last } },
  ], original)).rejects.toMatchObject({ cause: original, errors: [original, first, last] })
})

it.each(['reset', 'close'] as const)('retains failed compilation cleanup after %s supersedes its generation', async (operation) => {
  const primary = new Error('snapshot failed')
  const cleanup = new Error('provider disposal failed')
  const rebuilding = Promise.withResolvers<void>()
  const rebuilt = Promise.withResolvers<void>()
  const dispose = rejectDisposal('async', cleanup)
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => {
    const result = await compileHmrBatch({
      ctx: {} as CompilerContext,
      input: { revision: 1, changedFiles: [], sources: new Map() },
      needsSnapshot: true,
      patches: [],
      prepareProviders: async () => [{ dispose }],
      rebuild: async () => {
        rebuilding.resolve()
        await rebuilt.promise
        throw primary
      },
      sourcemap: false,
    })
    return { commit: async () => {}, publish: async () => {}, dispose: result.dispose }
  } })
  await rebuilding.promise
  const operationResult = queue[operation]()
  const waiting = expect(operation === 'close' ? operationResult! : queue.whenSettled()).rejects.toMatchObject({
    cause: primary,
    errors: [primary, cleanup],
  })
  rebuilt.resolve()
  await waiting
  expect(dispose).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledOnce()
  await expect(queue.close()).rejects.toMatchObject({ cause: primary, errors: [primary, cleanup] })
})

it.each(['reset', 'close'] as const)('retains compiler host partial-provider cleanup failure after %s', async (operation) => {
  const primary = new Error('provider failed')
  const cleanup = new Error('successful provider disposal failed')
  const preparing = Promise.withResolvers<void>()
  const prepared = Promise.withResolvers<void>()
  const dispose = rejectDisposal('async', cleanup)
  const onError = vi.fn()
  const host = new HmrCompilerHost()
  host.register('successful', async () => ({ dispose }))
  host.register('failing', async () => {
    preparing.resolve()
    await prepared.promise
    throw primary
  })
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => {
    const result = await compileHmrBatch({
      ctx: {} as CompilerContext,
      input: { revision: 1, changedFiles: [], sources: new Map() },
      needsSnapshot: false,
      patches: [],
      prepareProviders: () => host.prepare(host.freeze([])),
      rebuild: async () => ({ output: [] }),
      sourcemap: false,
    })
    return { commit: async () => {}, publish: async () => {}, dispose: result.dispose }
  } })
  await preparing.promise
  const operationResult = queue[operation]()
  const waiting = expect(operation === 'close' ? operationResult! : queue.whenSettled()).rejects.toMatchObject({
    cause: primary,
    errors: [primary, cleanup],
  })
  prepared.resolve()
  await waiting
  expect(dispose).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledOnce()
  await expect(queue.close()).rejects.toMatchObject({ cause: primary, errors: [primary, cleanup] })
})
