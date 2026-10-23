import type { CompilerContext } from './context'
import type { WatcherInstance } from './runtime/watcherPlugin'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { getCompilerContext, resetCompilerContext } from './context/getInstance'
import { createCompilerContext } from './createContext'
import { getInitialBuildInputObservation } from './runtime/buildPlugin/initialBuildChanges'
import { restartCompilerContextInputObservation } from './runtime/compilerSession/context'

const contexts: CompilerContext[] = []
const roots: string[] = []

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(async ctx => await ctx.watcherService.closeAll()))
  resetCompilerContext('default')
  await Promise.all(roots.splice(0).map(async root => await rm(root, { recursive: true, force: true })))
})

it('drains the previous default context before resetting it and creating replacement input ownership', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'legacy-context-input-'))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), '{"name":"legacy-context-input"}')
  await writeFile(path.join(root, 'project.config.json'), '{"miniprogramRoot":"dist"}')
  const previous = getCompilerContext('default')
  contexts.push(previous)
  const releasePrevious = restartCompilerContextInputObservation(previous)
  const previousObservation = getInitialBuildInputObservation(previous.configService)
  const started = Promise.withResolvers<void>()
  const finished = Promise.withResolvers<void>()
  previous.watcherService.rollupWatcherMap.set('/', {
    async close() {
      started.resolve()
      await finished.promise
    },
  } as WatcherInstance)
  const initializing = createCompilerContext({
    cwd: root,
    hostConfig: { config: { weapp: { autoRoutes: false, vue: { enable: false } } } },
    syncSupportFiles: false,
    preloadAppEntry: false,
  })
  await started.promise
  expect(getCompilerContext('default')).toBe(previous)
  expect(getInitialBuildInputObservation(previous.configService)).toBe(previousObservation)
  finished.resolve()
  const current = await initializing
  contexts.push(current)
  expect(current).not.toBe(previous)
  expect(getCompilerContext('default')).toBe(current)
  expect(getInitialBuildInputObservation(previous.configService)).toBeUndefined()
  const observation = getInitialBuildInputObservation(current.configService)
  expect(observation).toBeDefined()
  releasePrevious()
  releasePrevious()
  expect(getInitialBuildInputObservation(current.configService)).toBe(observation)
  await current.watcherService.closeAll()
  expect(getInitialBuildInputObservation(current.configService)).toBeUndefined()
})

it('retains the previous default context and propagates its watcher close failure', async () => {
  const previous = getCompilerContext('default')
  contexts.push(previous)
  restartCompilerContextInputObservation(previous)
  const failure = new Error('previous watcher close failed')
  previous.watcherService.rollupWatcherMap.set('/', {
    close: async () => { throw failure },
  } as WatcherInstance)
  await expect(createCompilerContext({ hostConfig: { config: {} }, syncSupportFiles: false, preloadAppEntry: false })).rejects.toBe(failure)
  expect(getCompilerContext('default')).toBe(previous)
  expect(getInitialBuildInputObservation(previous.configService)).toBeUndefined()
})
