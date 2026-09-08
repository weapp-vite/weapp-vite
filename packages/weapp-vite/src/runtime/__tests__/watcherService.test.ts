import type { MutableCompilerContext } from '../../context'
import type { WatcherInstance, WatcherService } from '../watcherPlugin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin, retainWatcherService } from '../watcherPlugin'

describe('watcherService', () => {
  let ctx: MutableCompilerContext
  let plugin: ReturnType<typeof createWatcherServicePlugin>
  let watcherService: WatcherService
  let mockWatcher: WatcherInstance & { on: ReturnType<typeof vi.fn> }
  let mockOldWatcher: WatcherInstance & { on: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    ctx = {
      runtimeState: createRuntimeState(),
    } as MutableCompilerContext
    plugin = createWatcherServicePlugin(ctx)
    watcherService = ctx.watcherService!

    const createMockWatcher = () => {
      return {
        close: vi.fn(),
        on: vi.fn(),
      }
    }

    mockWatcher = createMockWatcher()
    mockOldWatcher = createMockWatcher()
  })

  describe('setRollupWatcher', () => {
    it('sets a new RollupWatcher for the given root', () => {
      watcherService.setRollupWatcher(mockWatcher, '/project')

      const watcher = watcherService.rollupWatcherMap.get('/project')
      expect(watcher).toBe(mockWatcher)
    })

    it('replaces an existing watcher and closes the old one', () => {
      watcherService.setRollupWatcher(mockOldWatcher, '/project')
      watcherService.setRollupWatcher(mockWatcher, '/project')

      const watcher = watcherService.rollupWatcherMap.get('/project')
      expect(watcher).toBe(mockWatcher)
      expect(mockOldWatcher.close).toHaveBeenCalled()
    })

    it('handles the default root "/" correctly', () => {
      watcherService.setRollupWatcher(mockWatcher)

      const watcher = watcherService.rollupWatcherMap.get('/')
      expect(watcher).toBe(mockWatcher)
    })

    it('ignores missing previous watcher when closing', () => {
      expect(() => watcherService.setRollupWatcher(mockWatcher, '/new-project')).not.toThrow()

      const watcher = watcherService.rollupWatcherMap.get('/new-project')
      expect(watcher).toBe(mockWatcher)
    })
  })

  describe('getRollupWatcher', () => {
    it('returns watcher for a specific root or default root', () => {
      expect(watcherService.getRollupWatcher('/project')).toBeUndefined()
      watcherService.setRollupWatcher(mockWatcher, '/project')
      watcherService.setRollupWatcher(mockOldWatcher)

      expect(watcherService.getRollupWatcher('/project')).toBe(mockWatcher)
      expect(watcherService.getRollupWatcher()).toBe(mockOldWatcher)
    })
  })

  describe('close and closeAll', () => {
    it('closes rollup + sidecar watcher by root and closes web service when all cleared', async () => {
      const sidecarClose = vi.fn(async () => {})
      const webClose = vi.fn(async () => {})
      ctx.webService = {
        close: webClose,
      } as any

      watcherService.setRollupWatcher(mockWatcher, '/project')
      watcherService.sidecarWatcherMap.set('/project', {
        close: sidecarClose,
      })

      watcherService.close('/project')

      expect(mockWatcher.close).toHaveBeenCalledTimes(1)
      expect(sidecarClose).toHaveBeenCalledTimes(1)
      expect(watcherService.rollupWatcherMap.size).toBe(0)
      expect(watcherService.sidecarWatcherMap.size).toBe(0)

      await Promise.resolve()
      expect(webClose).toHaveBeenCalledTimes(1)
    })

    it('does not close web service when other watchers remain', async () => {
      const webClose = vi.fn(async () => {})
      ctx.webService = {
        close: webClose,
      } as any
      const anotherWatcher = {
        close: vi.fn(),
        on: vi.fn(),
      }

      watcherService.setRollupWatcher(mockWatcher, '/project')
      watcherService.setRollupWatcher(anotherWatcher, '/another')
      watcherService.close('/project')

      await Promise.resolve()
      expect(webClose).not.toHaveBeenCalled()
      expect(watcherService.getRollupWatcher('/another')).toBe(anotherWatcher as any)
    })

    it('closeAll clears all watchers and closes web service', async () => {
      const sidecarCloseA = vi.fn(async () => {})
      const sidecarCloseB = vi.fn(async () => {})
      const watcherB = {
        close: vi.fn(),
        on: vi.fn(),
      }
      const webClose = vi.fn(async () => {})
      ctx.webService = {
        close: webClose,
      } as any

      watcherService.setRollupWatcher(mockWatcher, '/a')
      watcherService.setRollupWatcher(watcherB, '/b')
      watcherService.sidecarWatcherMap.set('/a', { close: sidecarCloseA })
      watcherService.sidecarWatcherMap.set('/b', { close: sidecarCloseB })

      watcherService.closeAll()

      expect(mockWatcher.close).toHaveBeenCalledTimes(1)
      expect(watcherB.close).toHaveBeenCalledTimes(1)
      expect(sidecarCloseA).toHaveBeenCalledTimes(1)
      expect(sidecarCloseB).toHaveBeenCalledTimes(1)
      expect(watcherService.rollupWatcherMap.size).toBe(0)
      expect(watcherService.sidecarWatcherMap.size).toBe(0)

      await Promise.resolve()
      expect(webClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('plugin closeBundle', () => {
    it.each(['complete', 'failed'] as const)('keeps controller-owned resources through %s classic snapshots', async (outcome) => {
      const release = retainWatcherService(watcherService)
      watcherService.sidecarWatcherMap.set('auto-import', mockWatcher)
      for (let index = 0; index < 3; index++) {
        plugin.configResolved?.({ command: 'build', build: {} } as any)
        if (outcome === 'failed') {
          await plugin.buildEnd?.(new Error('snapshot failed'))
        }
        await plugin.closeBundle?.()
        expect(mockWatcher.close).not.toHaveBeenCalled()
      }
      await release()
      expect(mockWatcher.close).toHaveBeenCalledTimes(1)
      expect(watcherService.sidecarWatcherMap.size).toBe(0)
      await release()
      expect(mockWatcher.close).toHaveBeenCalledTimes(1)
    })

    it('releases resources only after the final controller owner exits', async () => {
      const first = retainWatcherService(watcherService)
      const second = retainWatcherService(watcherService)
      watcherService.sidecarWatcherMap.set('auto-import', mockWatcher)
      await first()
      plugin.configResolved?.({ command: 'build', build: {} } as any)
      await plugin.closeBundle?.()
      expect(mockWatcher.close).not.toHaveBeenCalled()
      await second()
      expect(mockWatcher.close).toHaveBeenCalledTimes(1)
      watcherService.sidecarWatcherMap.set('new-build', mockOldWatcher)
      plugin.configResolved?.({ command: 'build', build: {} } as any)
      await plugin.closeBundle?.()
      expect(mockOldWatcher.close).toHaveBeenCalledTimes(1)
    })

    it('does not close a controller from inside the snapshot it is waiting for', async () => {
      const release = retainWatcherService(watcherService)
      let finishSnapshot!: () => void
      const snapshot = new Promise<void>((resolve) => {
        finishSnapshot = resolve
      })
      const closeController = vi.fn(async () => {
        await snapshot
        watcherService.rollupWatcherMap.delete('/')
        await release()
      })
      watcherService.setRollupWatcher({ close: closeController })
      watcherService.sidecarWatcherMap.set('sidecar', mockWatcher)
      const closing = closeController()
      plugin.configResolved?.({ command: 'build', build: {} } as any)
      await plugin.closeBundle?.()
      expect(closeController).toHaveBeenCalledTimes(1)
      expect(mockWatcher.close).not.toHaveBeenCalled()
      finishSnapshot()
      await closing
      expect(mockWatcher.close).toHaveBeenCalledTimes(1)
    })

    it('closes all watchers when not in watch mode', async () => {
      ctx.configService = {
        isDev: false,
        inlineConfig: {
          build: {
            watch: false,
          },
        },
      } as any
      watcherService.setRollupWatcher(mockWatcher, '/project')

      plugin.closeBundle?.()
      await Promise.resolve()
      expect(mockWatcher.close).toHaveBeenCalledTimes(1)
      expect(watcherService.rollupWatcherMap.size).toBe(0)
    })

    it('keeps watchers for a resolved serve lifecycle', () => {
      ctx.configService = {
        isDev: true,
        inlineConfig: {},
      } as any
      plugin.configResolved?.({ command: 'serve', build: { watch: undefined } } as any)
      watcherService.setRollupWatcher(mockWatcher, '/project')

      plugin.closeBundle?.()
      expect(mockWatcher.close).not.toHaveBeenCalled()
      expect(watcherService.rollupWatcherMap.get('/project')).toBe(mockWatcher)
    })

    it.each(['complete', 'failed'] as const)('closes development snapshot watchers after a %s one-shot build', async (outcome) => {
      ctx.configService = { isDev: true, inlineConfig: {} } as any
      plugin.configResolved?.({ command: 'build', build: { watch: undefined } } as any)
      const snapshotWatcher = { close: vi.fn(async () => {}) }
      const activeRuntime = { runtimeState: createRuntimeState() } as MutableCompilerContext
      createWatcherServicePlugin(activeRuntime)
      const activeWatcher = { close: vi.fn() }
      activeRuntime.watcherService!.sidecarWatcherMap.set('auto-import', activeWatcher)
      watcherService.sidecarWatcherMap.set('auto-import', snapshotWatcher)
      if (outcome === 'failed') {
        await plugin.buildEnd?.(new Error('snapshot compilation failed'))
      }
      else {
        await plugin.closeBundle?.()
      }
      expect(snapshotWatcher.close).toHaveBeenCalledTimes(1)
      expect(watcherService.sidecarWatcherMap.size).toBe(0)
      expect(activeWatcher.close).not.toHaveBeenCalled()
      expect(activeRuntime.watcherService!.sidecarWatcherMap.get('auto-import')).toBe(activeWatcher)
    })

    it.each(['serve', 'build-watch'] as const)('keeps the %s watcher through compilation failures and closeBundle', async (mode) => {
      ctx.configService = { isDev: true, inlineConfig: {} } as any
      plugin.configResolved?.({ command: mode === 'serve' ? 'serve' : 'build', build: { watch: mode === 'build-watch' ? {} : undefined } } as any)
      watcherService.sidecarWatcherMap.set('auto-import', mockWatcher)
      await plugin.buildEnd?.(new Error('recoverable compilation failure'))
      await plugin.closeBundle?.()
      expect(mockWatcher.close).not.toHaveBeenCalled()
      expect(watcherService.sidecarWatcherMap.get('auto-import')).toBe(mockWatcher)
    })

    it('awaits snapshot watcher shutdown even when another watcher fails to close', async () => {
      ctx.configService = { isDev: true, inlineConfig: {} } as any
      plugin.configResolved?.({ command: 'build', build: {} } as any)
      let finishClose!: () => void
      const closePromise = new Promise<void>((resolve) => {
        finishClose = resolve
      })
      watcherService.sidecarWatcherMap.set('broken', { close: vi.fn(() => {
        throw new Error('close failed')
      }) })
      const close = vi.fn(() => closePromise)
      watcherService.sidecarWatcherMap.set('pending', { close })
      let complete = false
      const closing = Promise.resolve(plugin.closeBundle?.()).then(() => {
        complete = true
      })
      await Promise.resolve()
      expect(close).toHaveBeenCalledTimes(1)
      expect(complete).toBe(false)
      finishClose()
      await closing
      expect(complete).toBe(true)
      expect(watcherService.sidecarWatcherMap.size).toBe(0)
    })
  })
})
