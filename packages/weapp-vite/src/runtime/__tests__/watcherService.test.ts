import type { MutableCompilerContext } from '../../context'
import type { WatcherInstance, WatcherService } from '../watcherPlugin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin } from '../watcherPlugin'

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

    it('keeps watchers in watch mode', () => {
      ctx.configService = {
        isDev: true,
        inlineConfig: {},
      } as any
      watcherService.setRollupWatcher(mockWatcher, '/project')

      plugin.closeBundle?.()
      expect(mockWatcher.close).not.toHaveBeenCalled()
      expect(watcherService.rollupWatcherMap.get('/project')).toBe(mockWatcher)
    })
  })
})
