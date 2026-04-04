import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ensureSidecarWatcher } from './watcher'

const chokidarWatchMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}))
const invalidateEntryForSidecarMock = vi.hoisted(() => vi.fn(async () => {}))
const extractCssImportDependenciesMock = vi.hoisted(() => vi.fn())
const cleanupCssImporterGraphMock = vi.hoisted(() => vi.fn())

vi.mock('chokidar', () => ({
  default: {
    watch: chokidarWatchMock,
  },
}))

vi.mock('../../../logger', () => ({
  default: loggerMock,
}))

vi.mock('./sidecar', () => ({
  invalidateEntryForSidecar: invalidateEntryForSidecarMock,
}))

vi.mock('./cssGraph', () => ({
  extractCssImportDependencies: extractCssImportDependenciesMock,
  cleanupCssImporterGraph: cleanupCssImporterGraphMock,
}))

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

function createContext() {
  return {
    configService: {
      isDev: true,
      cwd: '/project',
      outDir: '/project/dist',
      relativeCwd: (value: string) => value.replace('/project/', ''),
    },
    runtimeState: {
      watcher: {
        sidecarWatcherMap: new Map<string, { close: () => Promise<void> | void }>(),
      },
    },
    wxmlService: {
      getImporters: (value: string) => {
        if (value === '/project/src/shared/helper.wxs') {
          return new Set(['/project/src/pages/hmr/index.wxml'])
        }
        return new Set<string>()
      },
    },
  } as any
}

describe('invalidateEntry sidecar watcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('treats raw rename on an existing known sidecar file as update after settle', async () => {
    vi.stubEnv('VITEST', '')
    vi.stubEnv('NODE_ENV', 'development')

    const existsSpy = vi.spyOn(fs, 'existsSync')
    const watcher = createChokidarWatcher()
    chokidarWatchMock.mockReturnValue(watcher)
    existsSpy.mockImplementation((value) => {
      const filePath = String(value)
      return filePath === '/project/src' || filePath === '/project/src/pages/hmr/index.wxml'
    })

    const ctx = createContext()
    ensureSidecarWatcher(ctx, '/project/src')

    watcher.emit('add', '/project/src/pages/hmr/index.wxml')
    watcher.emit('ready')

    invalidateEntryForSidecarMock.mockClear()
    loggerMock.info.mockClear()

    watcher.emit('raw', 'rename', 'pages/hmr/index.wxml', { watchedPath: '/project/src' })
    watcher.emit('raw', 'rename', 'pages/hmr/index.wxml', { watchedPath: '/project/src' })

    await vi.advanceTimersByTimeAsync(120)

    expect(invalidateEntryForSidecarMock).toHaveBeenCalledTimes(1)
    expect(invalidateEntryForSidecarMock).toHaveBeenCalledWith(ctx, '/project/src/pages/hmr/index.wxml', 'update')
    expect(loggerMock.info).toHaveBeenCalledWith('[watch:rename->update] src/pages/hmr/index.wxml')
  })

  it('derives delete for raw rename when the known sidecar file disappears', async () => {
    vi.stubEnv('VITEST', '')
    vi.stubEnv('NODE_ENV', 'development')

    const existsSpy = vi.spyOn(fs, 'existsSync')
    const watcher = createChokidarWatcher()
    chokidarWatchMock.mockReturnValue(watcher)
    existsSpy.mockImplementation((value) => {
      const filePath = String(value)
      return filePath === '/project/src'
    })

    const ctx = createContext()
    ensureSidecarWatcher(ctx, '/project/src')

    watcher.emit('add', '/project/src/pages/hmr/index.wxml')
    watcher.emit('ready')

    invalidateEntryForSidecarMock.mockClear()
    loggerMock.info.mockClear()

    watcher.emit('raw', 'rename', 'pages/hmr/index.wxml', { watchedPath: '/project/src' })
    await vi.advanceTimersByTimeAsync(120)

    expect(invalidateEntryForSidecarMock).toHaveBeenCalledTimes(1)
    expect(invalidateEntryForSidecarMock).toHaveBeenCalledWith(ctx, '/project/src/pages/hmr/index.wxml', 'delete')
    expect(loggerMock.info).toHaveBeenCalledWith('[watch:rename->delete] src/pages/hmr/index.wxml')
  })

  it('forwards wxs change events as sidecar invalidations', async () => {
    vi.stubEnv('VITEST', '')
    vi.stubEnv('NODE_ENV', 'development')

    const existsSpy = vi.spyOn(fs, 'existsSync')
    const watcher = createChokidarWatcher()
    chokidarWatchMock.mockReturnValue(watcher)
    existsSpy.mockImplementation((value) => {
      const filePath = String(value)
      return filePath === '/project/src' || filePath === '/project/src/shared/helper.wxs'
    })

    const ctx = createContext()
    ensureSidecarWatcher(ctx, '/project/src')

    watcher.emit('ready')
    watcher.emit('change', '/project/src/shared/helper.wxs')

    expect(invalidateEntryForSidecarMock).toHaveBeenCalledWith(ctx, '/project/src/shared/helper.wxs', 'update')
    expect(loggerMock.info).toHaveBeenCalledWith('[watch:update] src/shared/helper.wxs')
  })
})
