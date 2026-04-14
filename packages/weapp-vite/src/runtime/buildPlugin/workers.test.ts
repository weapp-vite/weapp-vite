import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildWorkers,
  checkWorkersOptions,
  devWorkers,
  resolveWorkerRenamePath,
  watchWorkers,
} from './workers'

const buildMock = vi.hoisted(() => vi.fn(async () => undefined))
const chokidarWatchMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
}))

vi.mock('vite', () => {
  return {
    build: buildMock,
  }
})

vi.mock('chokidar', () => {
  return {
    default: {
      watch: chokidarWatchMock,
    },
  }
})

vi.mock('../../context/shared', () => {
  return {
    logger: loggerMock,
  }
})

function createMockConfigService() {
  return {
    mergeWorkers: vi.fn(() => ({ mock: 'workers-config' })),
    weappViteConfig: {},
    inlineConfig: {},
    absoluteSrcRoot: '/project/src',
    relativeCwd: (value: string) => value.replace('/project/', ''),
  } as any
}

function createMockWatcherService() {
  return {
    setRollupWatcher: vi.fn(),
    sidecarWatcherMap: new Map<string, { close: () => Promise<void> | void }>(),
  } as any
}

function createChokidarWatcher() {
  const handlers = new Map<string, (...args: any[]) => void>()
  const watcher: any = {
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler)
      return watcher
    }),
    close: vi.fn(async () => {}),
    emit(event: string, ...args: any[]) {
      handlers.get(event)?.(...args)
    },
  }
  return watcher
}

beforeEach(() => {
  buildMock.mockReset()
  chokidarWatchMock.mockReset()
  loggerMock.error.mockReset()
  loggerMock.info.mockReset()
  loggerMock.success.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runtime buildPlugin workers', () => {
  it('resolves worker rename paths from raw watcher payloads', () => {
    expect(resolveWorkerRenamePath('new.ts', {
      watchedPath: '/project/src/workers',
      fallbackRoot: '/project/src/workers',
    })).toBe('/project/src/workers/new.ts')

    expect(resolveWorkerRenamePath('/project/src/workers/abs.ts', {
      watchedPath: '/project/src/workers',
      fallbackRoot: '/project/src/workers',
    })).toBe('/project/src/workers/abs.ts')

    expect(resolveWorkerRenamePath({
      toString: () => 'nested/task.ts',
    }, {
      fallbackRoot: '/project/src/workers',
    })).toBe('/project/src/workers/nested/task.ts')

    expect(resolveWorkerRenamePath(null, {
      watchedPath: '/project/src/workers',
      fallbackRoot: '/project/src/workers',
    })).toBe('')
  })

  it('checks workers options for plugin and normal targets', () => {
    const configService = createMockConfigService()
    const scanService = { workersDir: 'workers' } as any

    expect(checkWorkersOptions('plugin', configService, scanService)).toEqual({
      hasWorkersDir: false,
      workersDir: undefined,
    })

    expect(checkWorkersOptions('miniapp', configService, { workersDir: undefined } as any)).toEqual({
      hasWorkersDir: false,
      workersDir: undefined,
    })
  })

  it('throws when workers dir exists but worker.entry is missing', () => {
    const configService = createMockConfigService()
    const scanService = { workersDir: 'workers' } as any

    expect(() => checkWorkersOptions('miniapp', configService, scanService)).toThrow('请在 `vite.config.ts` / `weapp-vite.config.ts` 中设置 `weapp.worker.entry` 路径')
    expect(loggerMock.error).toHaveBeenCalledTimes(2)
  })

  it('returns workers info when worker.entry is configured', () => {
    const configService = createMockConfigService()
    configService.weappViteConfig.worker = {
      entry: ['index'],
    }
    const scanService = { workersDir: 'workers' } as any

    expect(checkWorkersOptions('miniapp', configService, scanService)).toEqual({
      hasWorkersDir: true,
      workersDir: 'workers',
    })
  })

  it('runs workers build in dev and build modes', async () => {
    const watcherInstance = { close: vi.fn() }
    buildMock.mockResolvedValueOnce(watcherInstance).mockResolvedValueOnce(undefined)
    const configService = createMockConfigService()
    const watcherService = createMockWatcherService()

    await devWorkers(configService, watcherService, 'workers')
    await buildWorkers(configService)

    expect(configService.mergeWorkers).toHaveBeenCalledTimes(2)
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(watcherService.setRollupWatcher).toHaveBeenCalledWith(watcherInstance, 'workers')
  })

  it('watches worker changes and handles add/change/rename logs', async () => {
    const existsSpy = vi.spyOn(fs, 'existsSync')
    const workerWatcher = createChokidarWatcher()
    const watcherInstance = { close: vi.fn() }

    buildMock.mockResolvedValue(watcherInstance)
    chokidarWatchMock.mockReturnValue(workerWatcher)
    existsSpy
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)

    const configService = createMockConfigService()
    const watcherService = createMockWatcherService()

    watchWorkers(configService, watcherService, 'workers')

    expect(chokidarWatchMock).toHaveBeenCalledWith('/project/src/workers', {
      persistent: true,
      ignoreInitial: true,
    })

    workerWatcher.emit('all', 'add', '/project/src/workers/a.ts')
    workerWatcher.emit('all', 'change', '/project/src/workers/b.ts')
    workerWatcher.emit('all', 'unlink', '')
    workerWatcher.emit('raw', 'rename', 'new.ts', { watchedPath: '/project/src/workers' })
    workerWatcher.emit('raw', 'rename', 'old.ts', { watchedPath: '/project/src/workers' })
    workerWatcher.emit('raw', 'rename', '/project/src/workers/abs.ts', { watchedPath: '/project/src/workers' })
    workerWatcher.emit('raw', 'rename', null, { watchedPath: '/project/src/workers' })
    workerWatcher.emit('raw', 'change', 'skip.ts', { watchedPath: '/project/src/workers' })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(watcherService.setRollupWatcher).toHaveBeenCalledWith(watcherInstance, 'workers')
    expect(loggerMock.success).toHaveBeenCalledWith('[workers:add] src/workers/a.ts')
    expect(loggerMock.info).toHaveBeenCalledWith('[workers:change] src/workers/b.ts')
    expect(loggerMock.success).toHaveBeenCalledWith('[workers:rename->add] src/workers/new.ts')
    expect(loggerMock.info).toHaveBeenCalledWith('[workers:rename->unlink] src/workers/old.ts')
    expect(loggerMock.success).toHaveBeenCalledWith('[workers:rename->add] src/workers/abs.ts')

    const handle = watcherService.sidecarWatcherMap.get('/project/src/workers')
    expect(handle).toBeDefined()
    await handle?.close()
    expect(workerWatcher.close).toHaveBeenCalledTimes(1)
  })

  it('forwards polling watcher options from inline config', () => {
    const workerWatcher = createChokidarWatcher()
    chokidarWatchMock.mockReturnValue(workerWatcher)

    const configService = createMockConfigService()
    configService.inlineConfig = {
      build: {
        watch: {
          chokidar: {
            usePolling: true,
            interval: 120,
          },
        },
      },
    }
    const watcherService = createMockWatcherService()

    watchWorkers(configService, watcherService, 'workers')

    expect(chokidarWatchMock).toHaveBeenCalledWith('/project/src/workers', {
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 120,
    })
  })
})
