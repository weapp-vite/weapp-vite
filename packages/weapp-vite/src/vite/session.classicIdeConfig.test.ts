import type { ViteDevServer } from 'vite'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { createHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { bindHostLifecycle, setHostRestartData, takeHostConfigRestartData, takeHostLifecycle } from './lifecycle'
import { WeappBuildSession } from './session'

const cleanup: Array<() => Promise<unknown>> = []

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close().catch(() => {})
  }
})

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'host-classic-config-'))
  cleanup.push(() => fs.remove(root))
  const file = path.join(root, 'project.private.config.json')
  const original = '{"setting":{"compileHotReLoad":true}}\r\n'
  await fs.writeFile(file, original)
  const runtime = createHmrRuntimeSession()
  cleanup.push(() => runtime.classicIdeConfig.close())
  const session = new WeappBuildSession(runtime)
  cleanup.push(() => session.close())
  await runtime.classicIdeConfig.activate(file)
  return { file, original, runtime, session }
}

it('keeps classic through configuration restarts and restores only when the current host exits', async () => {
  const { file, original, runtime, session } = await fixture()
  await session.close('restart')
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  const replacement = new WeappBuildSession(runtime)
  cleanup.push(() => replacement.close())
  await session.releaseClassicIdeConfig()
  await session.close()
  expect(await runtime.classicIdeConfig.readRequested(file)).toBe(original)
  await runtime.classicIdeConfig.activate(file)
  await replacement.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it('restores an unconsumed restart lease only after the old generation has closed', async () => {
  const { file, original, session } = await fixture()
  const entered = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  session.onClose(async () => {
    entered.resolve()
    await released.promise
  })
  const closing = session.close('restart')
  await entered.promise
  const restored = vi.fn()
  const discard = session.releaseClassicIdeConfig().then(restored)
  expect(restored).not.toHaveBeenCalled()
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  released.resolve()
  await closing
  await discard
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it('does not restore the IDE setting when an owned resource fails to close', async () => {
  const { file, runtime, session } = await fixture()
  const failure = new Error('owned watcher did not close')
  session.onClose(async () => {
    throw failure
  })
  const closing = session.close()
  const rejected = await closing.catch((error: unknown) => error)
  expect(rejected).toMatchObject({ errors: [failure] })
  await expect(session.close()).rejects.toBe(rejected)
  await expect(session.releaseClassicIdeConfig()).rejects.toBe(rejected)
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  expect(await runtime.classicIdeConfig.readRequested(file)).toContain('true')
})

it('keeps the private overlay until both the native host and its exact watcher have closed', async () => {
  const { file, original, session } = await fixture()
  const hostEntered = Promise.withResolvers<void>()
  const hostReleased = Promise.withResolvers<void>()
  const watcherEntered = Promise.withResolvers<void>()
  const watcherReleased = Promise.withResolvers<void>()
  const server = {
    config: { inlineConfig: {} },
    watcher: { close: async () => {
      watcherEntered.resolve()
      await watcherReleased.promise
    } },
    close: async () => {
      hostEntered.resolve()
      await hostReleased.promise
    },
    restart: vi.fn(async () => {}),
  } as unknown as ViteDevServer
  bindHostLifecycle(server, reason => session.closeHostGeneration(reason), undefined, undefined, () => session.releaseHostClassicIdeConfig())
  const closing = server.close()
  await Promise.all([hostEntered.promise, watcherEntered.promise])
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  hostReleased.resolve()
  await Promise.resolve()
  expect(await fs.pathExists(path.join(path.dirname(file), '.weapp-vite/ide-classic-project.private.config.json'))).toBe(true)
  watcherReleased.resolve()
  await closing
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it.each(['host', 'watcher'] as const)('retains the private overlay and original %s close failure', async (failedResource) => {
  const { file, session } = await fixture()
  const failure = new Error(`${failedResource} close failed`)
  const nativeClose = vi.fn(async () => {
    if (failedResource === 'host') {
      throw failure
    }
  })
  const closeWatcher = vi.fn(async () => {
    if (failedResource === 'watcher') {
      throw failure
    }
  })
  const finalize = vi.fn(() => session.releaseHostClassicIdeConfig())
  const server = { config: { inlineConfig: {} }, watcher: { close: closeWatcher }, close: nativeClose, restart: vi.fn(async () => {}) } as unknown as ViteDevServer
  bindHostLifecycle(server, reason => session.closeHostGeneration(reason), undefined, undefined, finalize)
  await expect(server.close()).rejects.toBe(failure)
  await expect(server.close()).rejects.toBe(failure)
  expect(nativeClose).toHaveBeenCalledOnce()
  expect(closeWatcher).toHaveBeenCalledOnce()
  expect(finalize).not.toHaveBeenCalled()
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  expect(await fs.pathExists(path.join(path.dirname(file), '.weapp-vite/ide-classic-project.private.config.json'))).toBe(true)
})

it('keeps a consumed runtime lease after replacement configuration fails until the original host exits', async () => {
  const { file, original, runtime, session } = await fixture()
  const key = Symbol('runtime')
  const failure = new Error('replacement configuration failed')
  const nativeClose = vi.fn(async () => {})
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: async () => {
      const lifecycle = takeHostLifecycle(server.config.inlineConfig)
      const inherited = takeHostConfigRestartData<typeof runtime>(lifecycle, key)
      expect(inherited).toBe(runtime)
      const replacement = new WeappBuildSession(inherited)
      cleanup.push(() => replacement.close())
      await replacement.close('restart')
      throw failure
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, reason => session.closeHostGeneration(reason), undefined, undefined, () => session.releaseHostClassicIdeConfig())
  await setHostRestartData(server, key, runtime)
  await expect(server.restart()).rejects.toBe(failure)
  expect(nativeClose).not.toHaveBeenCalled()
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  await server.close()
  expect(nativeClose).toHaveBeenCalledOnce()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it('does not restore while failed replacement startup closes inside the original native restart', async () => {
  const { file, original, runtime, session } = await fixture()
  const key = Symbol('runtime')
  const failure = new Error('replacement startup failed')
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const lifecycle = takeHostLifecycle(server.config.inlineConfig)
      const replacementSession = new WeappBuildSession(takeHostConfigRestartData<typeof runtime>(lifecycle, key))
      cleanup.push(() => replacementSession.close())
      const replacement = { config: { inlineConfig: {} }, close: vi.fn(async () => {}), restart: vi.fn(async () => {}) } as unknown as ViteDevServer
      bindHostLifecycle(replacement, reason => replacementSession.closeHostGeneration(reason), lifecycle, undefined, () => replacementSession.releaseHostClassicIdeConfig())
      await replacement.close()
      expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
      throw failure
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, reason => session.closeHostGeneration(reason), undefined, undefined, () => session.releaseHostClassicIdeConfig())
  await setHostRestartData(server, key, runtime)
  await expect(server.restart()).rejects.toBe(failure)
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  await server.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it('restores the exact private config before replacement terminal close can finish during native handoff', async () => {
  const { file, original, runtime, session } = await fixture()
  const key = Symbol('runtime')
  const prepared = Promise.withResolvers<ViteDevServer>()
  const handoff = Promise.withResolvers<void>()
  const hostClosing = Promise.withResolvers<void>()
  const hostReleased = Promise.withResolvers<void>()
  const watcherClosing = Promise.withResolvers<void>()
  const watcherReleased = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {
    hostClosing.resolve()
    await hostReleased.promise
  })
  const closeWatcher = vi.fn(async () => {
    watcherClosing.resolve()
    await watcherReleased.promise
  })
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: async () => {
      const lifecycle = takeHostLifecycle(server.config.inlineConfig)
      const replacementSession = new WeappBuildSession(takeHostConfigRestartData<typeof runtime>(lifecycle, key))
      cleanup.push(() => replacementSession.close())
      const replacement = {
        config: { inlineConfig: {} },
        watcher: { close: closeWatcher },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, reason => replacementSession.closeHostGeneration(reason), lifecycle, undefined, () => replacementSession.releaseHostClassicIdeConfig())
      prepared.resolve(replacement)
      await handoff.promise
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, reason => session.closeHostGeneration(reason), undefined, undefined, () => session.releaseHostClassicIdeConfig())
  await setHostRestartData(server, key, runtime)
  const restarting = server.restart()
  const replacement = await prepared.promise
  const exited = vi.fn()
  const closing = replacement.close().then(exited)
  const journal = path.join(path.dirname(file), '.weapp-vite/ide-classic-project.private.config.json')
  try {
    expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
    expect(exited).not.toHaveBeenCalled()
    expect(replacementClose).not.toHaveBeenCalled()
    handoff.resolve()
    await Promise.all([hostClosing.promise, watcherClosing.promise])
    hostReleased.resolve()
    expect(await fs.pathExists(journal)).toBe(true)
    expect(exited).not.toHaveBeenCalled()
    watcherReleased.resolve()
    await Promise.all([restarting, closing])
    expect(await fs.readFile(file, 'utf8')).toBe(original)
    expect(await fs.pathExists(journal)).toBe(false)
  }
  finally {
    handoff.resolve()
    hostReleased.resolve()
    watcherReleased.resolve()
    await Promise.all([restarting, closing])
  }
  await Promise.all([server.close(), replacement.close(), replacement.close()])
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  expect(exited).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(closeWatcher).toHaveBeenCalledOnce()
  expect(nativeClose).not.toHaveBeenCalled()
})
