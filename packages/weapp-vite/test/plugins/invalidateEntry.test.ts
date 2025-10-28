import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import logger from '@/logger'
import { extractCssImportDependencies, invalidateEntryForSidecar } from '@/plugins/utils/invalidateEntry'
import { createRuntimeState } from '@/runtime/runtimeState'
import { findJsEntry, touch } from '@/utils/file'

vi.mock('@/utils/file', async () => {
  const actual = await vi.importActual<any>('@/utils/file')
  return {
    ...actual,
    findJsEntry: vi.fn(),
    touch: vi.fn(),
  }
})

describe('invalidateEntryForSidecar', () => {
  const findJsEntryMock = vi.mocked(findJsEntry)
  const touchMock = vi.mocked(touch)
  const loggerSuccess = vi.spyOn(logger, 'success').mockImplementation(() => {})
  const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {})

  function toRelative(cwd: string, target: string) {
    const relative = path.relative(cwd, target).replace(/\\/g, '/')
    return relative || '.'
  }

  function createContext(options: { absoluteSrcRoot?: string, cwd?: string } = {}) {
    const absoluteSrcRoot = options.absoluteSrcRoot ?? '/project/src'
    const cwd = options.cwd ?? path.dirname(absoluteSrcRoot)
    const runtimeState = createRuntimeState()
    const configService = {
      absoluteSrcRoot,
      relativeCwd: vi.fn((p: string) => {
        return toRelative(cwd, p)
      }),
    }
    return {
      runtimeState,
      configService,
    } as any
  }

  beforeEach(() => {
    vi.clearAllMocks()
    loggerSuccess.mockClear()
    loggerInfo.mockClear()
  })

  afterAll(() => {
    loggerSuccess.mockRestore()
    loggerInfo.mockRestore()
  })

  it('touches script when json.ts sidecar is created', async () => {
    const ctx = createContext()
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/index/index.ts',
      predictions: [],
    })

    await invalidateEntryForSidecar(ctx, '/project/src/pages/index/index.json.ts', 'create')

    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/pages/index/index')
    expect(touchMock).toHaveBeenCalledWith('/project/src/pages/index/index.ts')
    expect(loggerSuccess).toHaveBeenCalledWith(expect.stringContaining('pages/index/index.json.ts'))
  })

  it('touches script and import chain when css sidecar is created via @import', async () => {
    const ctx = createContext()
    const { css } = ctx.runtimeState
    css.dependencyToImporters.set('/project/src/styles/theme.wxss', new Set(['/project/src/styles/reset.wxss']))
    css.importerToDependencies.set('/project/src/styles/reset.wxss', new Set(['/project/src/styles/theme.wxss']))
    css.dependencyToImporters.set('/project/src/styles/reset.wxss', new Set(['/project/src/app.wxss']))
    css.importerToDependencies.set('/project/src/app.wxss', new Set(['/project/src/styles/reset.wxss']))

    findJsEntryMock.mockImplementation(async (basePath: string) => {
      if (basePath === '/project/src/app') {
        return {
          path: '/project/src/app.ts',
          predictions: [],
        }
      }
      return {
        predictions: [],
      }
    })

    await invalidateEntryForSidecar(ctx, '/project/src/styles/theme.wxss', 'create')

    expect(touchMock).toHaveBeenCalledWith('/project/src/styles/reset.wxss')
    expect(touchMock).toHaveBeenCalledWith('/project/src/app.ts')
    expect(loggerSuccess).toHaveBeenCalledWith(expect.stringContaining('styles/theme.wxss'))
  })

  it('registers dependencies for @wv-keep-import', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wv-keep-import-'))
    const stylesDir = path.join(tmpRoot, 'styles')
    const importerPath = path.join(stylesDir, 'reset.wxss')
    const dependencyPath = path.join(stylesDir, 'theme.wxss')
    await fs.ensureDir(stylesDir)
    await fs.writeFile(importerPath, '@wv-keep-import \'./theme.wxss\';')
    await fs.writeFile(dependencyPath, '')

    const ctx = createContext({ absoluteSrcRoot: tmpRoot, cwd: tmpRoot })

    try {
      await extractCssImportDependencies(ctx, importerPath)

      const normalizedImporter = path.normalize(importerPath)
      const normalizedDependency = path.normalize(dependencyPath)

      const deps = ctx.runtimeState.css.importerToDependencies.get(normalizedImporter)
      expect(deps).toBeDefined()
      expect(deps?.has(normalizedDependency)).toBe(true)
      expect(deps?.has(normalizedDependency.slice(0, -path.extname(normalizedDependency).length))).toBe(true)

      findJsEntryMock.mockResolvedValue({
        predictions: [],
      })

      await invalidateEntryForSidecar(ctx, dependencyPath, 'create')

      expect(touchMock).toHaveBeenCalledWith(normalizedImporter)
      expect(loggerSuccess).toHaveBeenCalledWith(expect.stringContaining('styles/theme.wxss'))
    }
    finally {
      await fs.remove(tmpRoot)
    }
  })

  it('logs info when no related script or importer is found', async () => {
    const ctx = createContext()
    findJsEntryMock.mockResolvedValue({
      predictions: [],
    })

    await invalidateEntryForSidecar(ctx, '/project/src/styles/orphan.wxss', 'create')

    expect(touchMock).not.toHaveBeenCalled()
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining('styles/orphan.wxss'))
  })
})
