import type { RollupWatcher } from 'rollup'
import type { MutableCompilerContext } from '../../context'
import type { WatcherService } from '../watcherPlugin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWatcherServicePlugin } from '../watcherPlugin'

describe('watcherService', () => {
  let watcherService: WatcherService
  let mockRollupWatcher: RollupWatcher
  let mockOldRollupWatcher: RollupWatcher

  beforeEach(() => {
    const ctx = {} as MutableCompilerContext
    createWatcherServicePlugin(ctx)
    watcherService = ctx.watcherService!

    mockRollupWatcher = {
      close: vi.fn(),
      on: vi.fn(),
    } as unknown as RollupWatcher

    mockOldRollupWatcher = {
      close: vi.fn(),
      on: vi.fn(),
    } as unknown as RollupWatcher
  })

  describe('setRollupWatcher', () => {
    it('sets a new RollupWatcher for the given root', () => {
      watcherService.setRollupWatcher(mockRollupWatcher, '/project')

      const watcher = watcherService.rollupWatcherMap.get('/project')
      expect(watcher).toBe(mockRollupWatcher)
    })

    it('replaces an existing watcher and closes the old one', () => {
      watcherService.setRollupWatcher(mockOldRollupWatcher, '/project')
      watcherService.setRollupWatcher(mockRollupWatcher, '/project')

      const watcher = watcherService.rollupWatcherMap.get('/project')
      expect(watcher).toBe(mockRollupWatcher)
      expect(mockOldRollupWatcher.close).toHaveBeenCalled()
    })

    it('handles the default root "/" correctly', () => {
      watcherService.setRollupWatcher(mockRollupWatcher)

      const watcher = watcherService.rollupWatcherMap.get('/')
      expect(watcher).toBe(mockRollupWatcher)
    })

    it('ignores missing previous watcher when closing', () => {
      expect(() => watcherService.setRollupWatcher(mockRollupWatcher, '/new-project')).not.toThrow()

      const watcher = watcherService.rollupWatcherMap.get('/new-project')
      expect(watcher).toBe(mockRollupWatcher)
    })
  })
})
