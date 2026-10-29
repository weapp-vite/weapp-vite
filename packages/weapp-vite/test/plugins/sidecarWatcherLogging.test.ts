import type { CompilerContext } from '@/context'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import { fs as fsExtra } from '@weapp-core/shared/fs'
import path from 'pathe'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '@/logger'
import * as invalidateEntryModule from '@/plugins/utils/invalidateEntry'
import { createRuntimeState } from '@/runtime/runtimeState'

const chokidarState = vi.hoisted(() => ({ watch: vi.fn() }))

vi.mock('chokidar', () => ({
  default: {
    watch: chokidarState.watch,
  },
  watch: chokidarState.watch,
}))

const { watch: chokidarWatchMock } = chokidarState
let watcherMock: EventEmitter & { close: ReturnType<typeof vi.fn> }

const originalNodeEnv = process.env.NODE_ENV
const originalVitest = process.env.VITEST

function createContext(rootDir: string): CompilerContext {
  const runtimeState = createRuntimeState()
  return {
    runtimeState,
    configService: {
      isDev: true,
      absoluteSrcRoot: rootDir,
      relativeCwd(target: string) {
        const relative = path.relative(rootDir, target).replace(/\\/g, '/')
        return relative || '.'
      },
    },
  } as unknown as CompilerContext
}

describe('ensureSidecarWatcher logging', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    watcherMock = Object.assign(new EventEmitter(), {
      close: vi.fn(async () => {
        watcherMock.removeAllListeners()
      }),
    })
    chokidarWatchMock.mockReset().mockReturnValue(watcherMock)
    process.env.NODE_ENV = 'development'
    delete process.env.VITEST
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.NODE_ENV = originalNodeEnv
    if (originalVitest === undefined) {
      delete process.env.VITEST
    }
    else {
      process.env.VITEST = originalVitest
    }
  })

  it('logs add, change and unlink events', async () => {
    const rootDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'sidecar-logs-'))
    const ctx = createContext(rootDir)
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    const invalidateSpy = vi.spyOn(invalidateEntryModule, 'invalidateEntryForSidecar').mockResolvedValue()

    try {
      invalidateEntryModule.ensureSidecarWatcher(ctx, rootDir)
      expect(chokidarWatchMock).toHaveBeenCalledTimes(1)

      for (const event of ['add', 'change', 'unlink']) {
        expect(watcherMock.listenerCount(event)).toBeGreaterThan(0)
      }

      const targetPath = path.join(rootDir, 'foo.wxss')

      infoSpy.mockClear()
      watcherMock.emit('add', targetPath)
      expect(infoSpy).toHaveBeenCalledWith('[watch:create] foo.wxss')

      infoSpy.mockClear()
      watcherMock.emit('change', targetPath)
      expect(infoSpy).toHaveBeenCalledWith('[watch:update] foo.wxss')

      infoSpy.mockClear()
      watcherMock.emit('unlink', targetPath)
      expect(infoSpy).toHaveBeenCalledWith('[watch:delete] foo.wxss')
    }
    finally {
      await Promise.all([...ctx.runtimeState.watcher.sidecarWatcherMap.values()].map(sidecar => sidecar.close()))
      infoSpy.mockRestore()
      invalidateSpy.mockRestore()
      await fsExtra.remove(rootDir)
    }
  })

  it('logs rename events based on file existence', async () => {
    const rootDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'sidecar-rename-'))
    const ctx = createContext(rootDir)
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    const originalExistsSync = fs.existsSync
    const renameAbsolute = path.join(rootDir, 'foo.wxss')
    let renameExists = true
    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((input: fs.PathLike) => {
      if (typeof input === 'string' && path.normalize(input) === path.normalize(renameAbsolute)) {
        return renameExists
      }
      return originalExistsSync(input)
    })

    try {
      invalidateEntryModule.ensureSidecarWatcher(ctx, rootDir)
      expect(watcherMock.listenerCount('raw')).toBeGreaterThan(0)

      const relativeTarget = 'foo.wxss'
      infoSpy.mockClear()
      renameExists = true
      watcherMock.emit('raw', 'rename', relativeTarget)
      await vi.advanceTimersByTimeAsync(120)
      expect(infoSpy).toHaveBeenCalledWith('[watch:rename->create] foo.wxss')

      infoSpy.mockClear()
      watcherMock.emit('add', renameAbsolute)
      renameExists = false
      watcherMock.emit('raw', 'rename', relativeTarget)
      await vi.advanceTimersByTimeAsync(120)
      expect(infoSpy).toHaveBeenCalledWith('[watch:rename->delete] foo.wxss')
    }
    finally {
      await Promise.all([...ctx.runtimeState.watcher.sidecarWatcherMap.values()].map(sidecar => sidecar.close()))
      infoSpy.mockRestore()
      existsSpy.mockRestore()
      await fsExtra.remove(rootDir)
    }
  })
})
