import type { MutableCompilerContext } from '../../context'
import type { WatcherInstance, WatcherService } from '../watcherPlugin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWatcherServicePlugin } from '../watcherPlugin'

describe('watcherService', () => {
  let watcherService: WatcherService
  let mockWatcher: WatcherInstance & { on: ReturnType<typeof vi.fn> }
  let mockOldWatcher: WatcherInstance & { on: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    const ctx = {} as MutableCompilerContext
    createWatcherServicePlugin(ctx)
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
})
