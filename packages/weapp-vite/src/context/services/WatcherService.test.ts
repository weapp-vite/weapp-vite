import type { RollupWatcher } from 'rollup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WatcherService } from './WatcherService'

describe('watcherService', () => {
  let watcherService: WatcherService
  let mockRollupWatcher: RollupWatcher
  let mockOldRollupWatcher: RollupWatcher

  beforeEach(() => {
    // 初始化 WatcherService 实例
    watcherService = new WatcherService()

    // 创建 Mock RollupWatcher
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
    it('should set a new RollupWatcher for the given root', () => {
      watcherService.setRollupWatcher(mockRollupWatcher, '/project')

      const watcher = watcherService.rollupWatcherMap.get('/project')
      expect(watcher).toBe(mockRollupWatcher)
    })

    it('should replace an existing watcher and close the old one', () => {
      // 设置旧的 Watcher
      watcherService.setRollupWatcher(mockOldRollupWatcher, '/project')

      // 替换成新的 Watcher
      watcherService.setRollupWatcher(mockRollupWatcher, '/project')

      const watcher = watcherService.rollupWatcherMap.get('/project')
      expect(watcher).toBe(mockRollupWatcher)
      expect(mockOldRollupWatcher.close).toHaveBeenCalled() // 验证旧的 watcher 被关闭
    })

    it('should handle the default root "/" correctly', () => {
      watcherService.setRollupWatcher(mockRollupWatcher)

      const watcher = watcherService.rollupWatcherMap.get('/')
      expect(watcher).toBe(mockRollupWatcher)
    })

    it('should not throw if there is no existing watcher to close', () => {
      expect(() => watcherService.setRollupWatcher(mockRollupWatcher, '/new-project')).not.toThrow()

      const watcher = watcherService.rollupWatcherMap.get('/new-project')
      expect(watcher).toBe(mockRollupWatcher)
    })
  })
})
