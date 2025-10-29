import type { CompilerContext } from '@/context'
import fs from 'node:fs'
import os from 'node:os'
import fsExtra from 'fs-extra'
import path from 'pathe'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '@/logger'
import * as invalidateEntryModule from '@/plugins/utils/invalidateEntry'
import { createRuntimeState } from '@/runtime/runtimeState'

const chokidarState = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => void>()
  const watcher = {
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler)
      return watcher
    }),
    close: vi.fn(),
  }
  const watch = vi.fn(() => watcher)
  return {
    handlers,
    watcher,
    watch,
  }
})

vi.mock('chokidar', () => ({
  default: {
    watch: chokidarState.watch,
  },
  watch: chokidarState.watch,
}))

const { handlers: chokidarHandlers, watcher: watcherMock, watch: chokidarWatchMock } = chokidarState

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
    chokidarHandlers.clear()
    watcherMock.on.mockClear()
    watcherMock.close.mockClear()
    chokidarWatchMock.mockClear()
    process.env.NODE_ENV = 'development'
    delete process.env.VITEST
  })

  afterEach(() => {
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

      const addHandler = chokidarHandlers.get('add')
      const changeHandler = chokidarHandlers.get('change')
      const unlinkHandler = chokidarHandlers.get('unlink')

      expect(addHandler).toBeTypeOf('function')
      expect(changeHandler).toBeTypeOf('function')
      expect(unlinkHandler).toBeTypeOf('function')

      const targetPath = path.join(rootDir, 'foo.wxss')

      infoSpy.mockClear()
      addHandler?.(targetPath)
      expect(infoSpy).toHaveBeenCalledWith('[watch:create] foo.wxss')

      infoSpy.mockClear()
      changeHandler?.(targetPath)
      expect(infoSpy).toHaveBeenCalledWith('[watch:update] foo.wxss')

      infoSpy.mockClear()
      unlinkHandler?.(targetPath)
      expect(infoSpy).toHaveBeenCalledWith('[watch:delete] foo.wxss')
    }
    finally {
      ctx.runtimeState.watcher.sidecarWatcherMap.forEach(sidecar => sidecar.close())
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
      const rawHandler = chokidarHandlers.get('raw')
      expect(rawHandler).toBeTypeOf('function')

      const relativeTarget = 'foo.wxss'

      infoSpy.mockClear()
      renameExists = true
      rawHandler?.('rename', relativeTarget)
      expect(infoSpy).toHaveBeenCalledWith('[watch:rename->create] foo.wxss')

      infoSpy.mockClear()
      renameExists = false
      rawHandler?.('rename', relativeTarget)
      expect(infoSpy).toHaveBeenCalledWith('[watch:rename->delete] foo.wxss')
    }
    finally {
      ctx.runtimeState.watcher.sidecarWatcherMap.forEach(sidecar => sidecar.close())
      infoSpy.mockRestore()
      existsSpy.mockRestore()
      await fsExtra.remove(rootDir)
    }
  })
})
