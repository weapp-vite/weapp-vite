import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findJsEntry } from '../../../utils/file'
import {
  cleanupCssImporterGraph,
  collectAffectedScriptsAndImporters,
  extractCssImportDependencies,
  syncCssImportDependencies,
  syncVueSfcStyleDependencies,
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
      '@use "./tokens.scss" as tokens;',
      '@forward "./mixins.scss";',
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
      const tokens = path.normalize(path.join(stylesDir, 'tokens.scss'))
      const mixins = path.normalize(path.join(stylesDir, 'mixins.scss'))
      const legacy = path.normalize(path.join(stylesDir, 'legacy.less'))
      const base = path.normalize(path.join(srcRoot, 'global/base.wxss'))
      const rootAbsolute = path.normalize(path.join(srcRoot, 'absolute/root.wxss'))

      expect(deps).toEqual(new Set([
        theme,
        theme.slice(0, -path.extname(theme).length),
        tokens,
        tokens.slice(0, -path.extname(tokens).length),
        mixins,
        mixins.slice(0, -path.extname(mixins).length),
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

  it('tracks vue sfc style imports and src blocks as css importers', async () => {
    const srcRoot = '/project/src'
    const ctx = createCtx(srcRoot)
    const vueFile = '/project/src/pages/index/index.vue'
    const hello = '/project/src/pages/index/hello.css'
    const external = '/project/src/pages/index/external.css'
    const global = '/project/src/styles/global.scss'

    const dependencies = syncVueSfcStyleDependencies(ctx, vueFile, [
      {
        content: '@import "./hello.css";\n@use "@/styles/global.scss" as global;',
      },
      {
        content: '',
        src: './external.css',
      },
    ] as any)

    expect(dependencies).toEqual(new Set([
      hello,
      hello.slice(0, -'.css'.length),
      global,
      global.slice(0, -'.scss'.length),
      external,
      external.slice(0, -'.css'.length),
    ]))
    expect(ctx.runtimeState.css.dependencyToImporters.get(hello)).toEqual(new Set([vueFile]))
    expect(ctx.runtimeState.css.dependencyToImporters.get(hello.slice(0, -'.css'.length))).toEqual(new Set([vueFile]))
    expect(ctx.runtimeState.css.dependencyToImporters.get(external)).toEqual(new Set([vueFile]))
    expect(ctx.runtimeState.css.dependencyToImporters.get(global)).toEqual(new Set([vueFile]))

    syncVueSfcStyleDependencies(ctx, vueFile, [])

    expect(ctx.runtimeState.css.dependencyToImporters.get(hello)).toBeUndefined()
    expect(ctx.runtimeState.css.dependencyToImporters.get(external)).toBeUndefined()
    expect(ctx.runtimeState.css.dependencyToImporters.get(global)).toBeUndefined()
  })

  it('syncs css imports from in-memory style content and preprocess dependencies', () => {
    const srcRoot = '/project/src'
    const ctx = createCtx(srcRoot)
    const importer = '/project/src/components/card/index.scss'
    const shared = '/project/src/shared/styles/shared.scss'
    const viteDep = '/project/src/shared/styles/mixins.scss'

    const dependencies = syncCssImportDependencies(
      ctx,
      importer,
      '@import "../../shared/styles/shared.scss";',
      [viteDep],
    )

    expect(dependencies).toEqual(new Set([
      shared,
      shared.slice(0, -'.scss'.length),
      viteDep,
      viteDep.slice(0, -'.scss'.length),
    ]))
    expect(ctx.runtimeState.css.dependencyToImporters.get(shared)).toEqual(new Set([importer]))
    expect(ctx.runtimeState.css.dependencyToImporters.get(viteDep)).toEqual(new Set([importer]))
  })

  it('keeps css graph sets stable when dependencies are unchanged', () => {
    const srcRoot = '/project/src'
    const ctx = createCtx(srcRoot)
    const importer = '/project/src/components/card/index.scss'
    const shared = '/project/src/shared/styles/shared.scss'

    syncCssImportDependencies(ctx, importer, '@import "../../shared/styles/shared.scss";')

    const normalizedImporter = path.normalize(importer)
    const normalizedShared = path.normalize(shared)
    const previousDeps = ctx.runtimeState.css.importerToDependencies.get(normalizedImporter)
    const previousImporters = ctx.runtimeState.css.dependencyToImporters.get(normalizedShared)

    syncCssImportDependencies(ctx, importer, '@import "../../shared/styles/shared.scss";')

    expect(ctx.runtimeState.css.importerToDependencies.get(normalizedImporter)).toBe(previousDeps)
    expect(ctx.runtimeState.css.dependencyToImporters.get(normalizedShared)).toBe(previousImporters)

    previousImporters?.delete(normalizedImporter)
    syncCssImportDependencies(ctx, importer, '@import "../../shared/styles/shared.scss";')

    expect(ctx.runtimeState.css.importerToDependencies.get(normalizedImporter)).not.toBe(previousDeps)
    expect(ctx.runtimeState.css.dependencyToImporters.get(normalizedShared)).toEqual(new Set([normalizedImporter]))
  })

  it('skips css graph updates when runtime css state is unavailable', async () => {
    const ctx = {
      configService: {
        absoluteSrcRoot: '/project/src',
      },
      runtimeState: {},
    } as any

    await expect(extractCssImportDependencies(ctx, '/project/src/styles/missing.wxss')).resolves.toBeUndefined()
    expect(() => syncVueSfcStyleDependencies(ctx, '/project/src/pages/index/index.vue', [
      {
        content: '@import "./hello.css";',
      },
    ] as any)).not.toThrow()
  })
})
