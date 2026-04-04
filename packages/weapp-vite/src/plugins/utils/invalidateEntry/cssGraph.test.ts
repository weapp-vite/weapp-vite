import os from 'node:os'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findJsEntry } from '../../../utils/file'
import {
  cleanupCssImporterGraph,
  collectAffectedScriptsAndImporters,
  extractCssImportDependencies,
} from './cssGraph'

vi.mock('../../../utils/file', () => ({
  findJsEntry: vi.fn(),
}))

const findJsEntryMock = vi.mocked(findJsEntry)

function createCtx(absoluteSrcRoot: string) {
  return {
    configService: {
      absoluteSrcRoot,
    },
    runtimeState: {
      css: {
        importerToDependencies: new Map<string, Set<string>>(),
        dependencyToImporters: new Map<string, Set<string>>(),
      },
    },
  } as any
}

describe('invalidateEntry cssGraph', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('extracts css imports and updates dependency graph with cleanup of stale edges', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wv-css-graph-'))
    const srcRoot = path.join(tmpRoot, 'src')
    const stylesDir = path.join(srcRoot, 'styles')
    const importer = path.join(stylesDir, 'reset.wxss')
    const ctx = createCtx(srcRoot)

    await fs.ensureDir(stylesDir)
    await fs.writeFile(importer, [
      '@import "./theme.wxss";',
      '@import "~./legacy.less?inline=1";',
      '@wv-keep-import "@/global/base.wxss";',
      '@import "@";',
      '@import "/absolute/root.wxss";',
      '@import "https://cdn.example.com/skip.css";',
    ].join('\n'))

    try {
      await extractCssImportDependencies(ctx, importer)
      const normalizedImporter = path.normalize(importer)
      const deps = ctx.runtimeState.css.importerToDependencies.get(normalizedImporter)
      expect(deps).toBeDefined()

      const theme = path.normalize(path.join(stylesDir, 'theme.wxss'))
      const legacy = path.normalize(path.join(stylesDir, 'legacy.less'))
      const base = path.normalize(path.join(srcRoot, 'global/base.wxss'))
      const rootAbsolute = path.normalize(path.join(srcRoot, 'absolute/root.wxss'))

      expect(deps).toEqual(new Set([
        theme,
        theme.slice(0, -path.extname(theme).length),
        legacy,
        legacy.slice(0, -path.extname(legacy).length),
        base,
        base.slice(0, -path.extname(base).length),
        path.normalize(srcRoot),
        rootAbsolute,
        rootAbsolute.slice(0, -path.extname(rootAbsolute).length),
      ]))

      await fs.writeFile(importer, '@import "./theme.wxss";')
      await extractCssImportDependencies(ctx, importer)

      const updatedDeps = ctx.runtimeState.css.importerToDependencies.get(normalizedImporter)
      expect(updatedDeps).toEqual(new Set([
        theme,
        theme.slice(0, -path.extname(theme).length),
      ]))
      expect(ctx.runtimeState.css.dependencyToImporters.get(base)).toBeUndefined()
      expect(ctx.runtimeState.css.dependencyToImporters.get(rootAbsolute)).toBeUndefined()
    }
    finally {
      await fs.remove(tmpRoot)
    }
  })

  it('cleans graph when importer is missing, not a file, or deleted manually', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wv-css-graph-clean-'))
    const srcRoot = path.join(tmpRoot, 'src')
    const stylesDir = path.join(srcRoot, 'styles')
    const importerFile = path.join(stylesDir, 'entry.wxss')
    const importerDir = path.join(stylesDir, 'dir.wxss')
    const dep = path.join(stylesDir, 'dep.wxss')
    const ctx = createCtx(srcRoot)
    const normalizedDep = path.normalize(dep)

    await fs.ensureDir(stylesDir)
    await fs.writeFile(importerFile, '@import "./dep.wxss";')
    await fs.ensureDir(importerDir)

    try {
      for (const importer of [importerFile, importerDir, path.join(stylesDir, 'missing.wxss')]) {
        const normalizedImporter = path.normalize(importer)
        ctx.runtimeState.css.importerToDependencies.set(normalizedImporter, new Set([normalizedDep]))
        ctx.runtimeState.css.dependencyToImporters.set(normalizedDep, new Set([normalizedImporter]))
      }

      await extractCssImportDependencies(ctx, importerDir)
      await extractCssImportDependencies(ctx, path.join(stylesDir, 'missing.wxss'))
      cleanupCssImporterGraph(ctx, importerFile)

      expect(ctx.runtimeState.css.importerToDependencies.size).toBe(0)
      expect(ctx.runtimeState.css.dependencyToImporters.size).toBe(0)
    }
    finally {
      await fs.remove(tmpRoot)
    }
  })

  it('collects affected css importers and scripts with bfs traversal and script lookup cache', async () => {
    const srcRoot = '/project/src'
    const ctx = createCtx(srcRoot)
    const theme = '/project/src/styles/theme.wxss'
    const resetWxss = '/project/src/styles/reset.wxss'
    const resetScss = '/project/src/styles/reset.scss'
    const appWxss = '/project/src/app.wxss'

    ctx.runtimeState.css.dependencyToImporters.set(theme, new Set([resetWxss, resetScss]))
    ctx.runtimeState.css.dependencyToImporters.set('/project/src/styles/reset', new Set([appWxss]))
    ctx.runtimeState.css.dependencyToImporters.set(resetWxss, new Set([appWxss]))

    findJsEntryMock.mockImplementation(async (basePath: string) => {
      if (basePath === '/project/src/styles/reset') {
        return {
          path: '/project/src/styles/reset.ts',
          predictions: [],
        }
      }
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

    const result = await collectAffectedScriptsAndImporters(ctx, theme)

    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/styles/theme')
    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/styles/reset')
    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/app')
    expect(findJsEntryMock).toHaveBeenCalledTimes(3)
    expect(result.importers).toEqual(new Set([resetWxss, resetScss, appWxss]))
    expect(result.scripts).toEqual(new Set(['/project/src/styles/reset.ts', '/project/src/app.ts']))
  })
})
