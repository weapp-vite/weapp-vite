import type { CompilerContext } from '../../context'
import type { WatcherInstance } from '../watcherPlugin'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { getInitialBuildInputObservation } from '../buildPlugin/initialBuildChanges'
import { onWatcherServiceDrained } from '../watcherPlugin'
import { initializeCompilerContext, restartCompilerContextInputObservation } from './context'

const contexts: CompilerContext[] = []
const roots: string[] = []
const options = { hostConfig: { config: {} }, syncSupportFiles: false, preloadAppEntry: false }

function context() {
  const ctx = createCompilerContextInstance()
  contexts.push(ctx)
  vi.spyOn(ctx.configService, 'load').mockResolvedValue(ctx.configService.options)
  return ctx
}

async function input() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'compiler-context-input-')))
  roots.push(root)
  const file = path.join(root, 'index.ts')
  await writeFile(file, 'Page({ data: { marker: "BASE" } })')
  return file
}

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(async ctx => await ctx.watcherService.closeAll()))
  await Promise.all(roots.splice(0).map(async root => await rm(root, { recursive: true, force: true })))
})

it('waits for the old watcher drain before establishing replacement input ownership', async () => {
  const ctx = context()
  const file = await input()
  const releaseOld = restartCompilerContextInputObservation(ctx)
  const oldObservation = getInitialBuildInputObservation(ctx.configService)
  await readCompilerInput(ctx.configService, file)
  const closing = Promise.withResolvers<void>()
  const started = Promise.withResolvers<void>()
  const order: string[] = []
  ctx.watcherService.rollupWatcherMap.set('/', {
    async close() {
      order.push('closing')
      started.resolve()
      await closing.promise
      order.push('closed')
    },
  } as WatcherInstance)
  onWatcherServiceDrained(ctx.watcherService, () => {
    order.push('drained')
    releaseOld()
  })
  vi.mocked(ctx.configService.load).mockImplementation(async () => {
    expect(getInitialBuildInputObservation(ctx.configService)).not.toBe(oldObservation)
    order.push('load')
    await readCompilerInput(ctx.configService, file)
    return ctx.configService.options
  })
  const initializing = initializeCompilerContext(ctx, options)
  await started.promise
  expect(getInitialBuildInputObservation(ctx.configService)).toBe(oldObservation)
  expect(ctx.configService.load).not.toHaveBeenCalled()
  await writeFile(file, 'Page({ data: { marker: "FALLBACK-A" } })')
  closing.resolve()
  await initializing
  expect(order).toEqual(['closing', 'closed', 'drained', 'load'])
  const observation = getInitialBuildInputObservation(ctx.configService)!
  releaseOld()
  releaseOld()
  expect(getInitialBuildInputObservation(ctx.configService)).toBe(observation)
  observation.begin()
  observation.commit()
  expect(await observation.filter([{ file, event: 'update', verifyInitialInput: true }])).toEqual([])
  await ctx.watcherService.closeAll()
  expect(getInitialBuildInputObservation(ctx.configService)).toBeUndefined()
})

it('releases input ownership when initialization fails without clearing a replacement generation', async () => {
  const ctx = context()
  const failure = new Error('invalid configuration')
  let replacement: ReturnType<typeof getInitialBuildInputObservation>
  vi.mocked(ctx.configService.load).mockImplementation(async () => {
    restartCompilerContextInputObservation(ctx)
    replacement = getInitialBuildInputObservation(ctx.configService)
    throw failure
  })
  await expect(initializeCompilerContext(ctx, options)).rejects.toBe(failure)
  expect(replacement).toBeDefined()
  expect(getInitialBuildInputObservation(ctx.configService)).toBe(replacement)
  await ctx.watcherService.closeAll()
  expect(getInitialBuildInputObservation(ctx.configService)).toBeUndefined()
})

it('releases an unsuccessful configuration load and an ignored pre-scan failure', async () => {
  const configContext = context()
  const failure = new Error('invalid configuration')
  vi.mocked(configContext.configService.load).mockRejectedValue(failure)
  await expect(initializeCompilerContext(configContext, options)).rejects.toBe(failure)
  expect(getInitialBuildInputObservation(configContext.configService)).toBeUndefined()

  const scanContext = context()
  vi.spyOn(scanContext.scanService, 'loadAppEntry').mockRejectedValue(new Error('invalid app entry'))
  await expect(initializeCompilerContext(scanContext, { ...options, preloadAppEntry: true })).resolves.toBe(scanContext)
  expect(getInitialBuildInputObservation(scanContext.configService)).toBeUndefined()
})

it('does not establish a new observer when the previous resource drain fails', async () => {
  const ctx = context()
  restartCompilerContextInputObservation(ctx)
  const failure = new Error('watcher close failed')
  ctx.watcherService.rollupWatcherMap.set('/', {
    close: async () => { throw failure },
  } as WatcherInstance)
  await expect(initializeCompilerContext(ctx, options)).rejects.toBe(failure)
  expect(ctx.configService.load).not.toHaveBeenCalled()
  expect(getInitialBuildInputObservation(ctx.configService)).toBeUndefined()
})

it('isolates the classic input generation from stateful reads and sibling contexts', async () => {
  const ctx = context()
  const other = context()
  const file = await input()
  const releaseStateful = restartCompilerContextInputObservation(ctx)
  restartCompilerContextInputObservation(other)
  const otherObservation = getInitialBuildInputObservation(other.configService)
  await readCompilerInput(ctx.configService, file)
  await writeFile(file, 'Page({ data: { marker: "FALLBACK-A" } })')
  restartCompilerContextInputObservation(ctx)
  const observation = getInitialBuildInputObservation(ctx.configService)!
  await readCompilerInput(ctx.configService, file)
  observation.begin()
  await readCompilerInput(ctx.configService, file)
  observation.commit()
  releaseStateful()
  expect(getInitialBuildInputObservation(ctx.configService)).toBe(observation)
  expect(await observation.filter([{ file, event: 'update', verifyInitialInput: true }])).toEqual([])
  await ctx.watcherService.closeAll()
  await ctx.watcherService.closeAll()
  expect(getInitialBuildInputObservation(ctx.configService)).toBeUndefined()
  expect(getInitialBuildInputObservation(other.configService)).toBe(otherObservation)
})

it('releases an initialized context on final drain even when no build has started', async () => {
  const ctx = context()
  await initializeCompilerContext(ctx, options)
  expect(getInitialBuildInputObservation(ctx.configService)).toBeDefined()
  await ctx.watcherService.closeAll()
  expect(getInitialBuildInputObservation(ctx.configService)).toBeUndefined()
})
