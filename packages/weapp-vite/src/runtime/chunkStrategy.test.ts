import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY, resolveSharedChunkName, SHARED_CHUNK_VIRTUAL_PREFIX, SUB_PACKAGE_SHARED_DIR } from './chunkStrategy'

const ROOT = '/project/src'

function createCtx(importers: string[]) {
  return {
    getModuleInfo: () => {
      return { importers }
    },
  }
}

function relativeAbsoluteSrcRoot(id: string) {
  return id.replace(`${ROOT}/`, '')
}

describe('resolveSharedChunkName', () => {
  it('returns sub-package common chunk when only one prefix', () => {
    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx([`${ROOT}/packageA/foo.ts`, `${ROOT}/packageA/bar.ts`]),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
    })

    expect(result).toBe('packageA/common')
  })

  it('在策略为 hoist 时会提炼到主包', () => {
    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx([`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`]),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: 'hoist',
    })

    expect(result).toBe('common')
  })

  it('默认策略会将跨分包模块标记为复制', () => {
    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx([`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`]),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
    })

    expect(result).toBe(`${SHARED_CHUNK_VIRTUAL_PREFIX}/packageA+packageB/common`)
  })

  it('still hoists when main package participates', () => {
    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx([`${ROOT}/packageA/foo.ts`, `${ROOT}/app.ts`]),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA'],
      strategy: 'duplicate',
    })

    expect(result).toBe('common')
  })
})

describe('applySharedChunkStrategy', () => {
  it('duplicates shared chunks into each sub-package and rewrites importers', () => {
    const sharedFileName = `${SHARED_CHUNK_VIRTUAL_PREFIX}/packageA+packageB/common.js`
    const sharedChunk: OutputChunk = {
      type: 'chunk',
      code: '// shared chunk',
      fileName: sharedFileName,
      name: 'common',
      modules: {},
      imports: [],
      dynamicImports: [],
      exports: [],
      isEntry: false,
      facadeModuleId: null,
      isDynamicEntry: false,
      moduleIds: [],
      map: null,
      sourcemapFileName: `${sharedFileName}.map`,
      preliminaryFileName: sharedFileName,
    }

    const importerAFile = 'packageA/index.js'
    const importerBFile = 'packageB/index.js'
    const importerACode = `const shared = require('../${sharedFileName}');`
    const importerBCode = `const shared = require('../${sharedFileName}');`
    const importerA: OutputChunk = {
      type: 'chunk',
      code: importerACode,
      fileName: importerAFile,
      name: 'packageA/pages/index',
      modules: {},
      imports: [sharedFileName],
      dynamicImports: [],
      exports: [],
      isEntry: true,
      facadeModuleId: null,
      isDynamicEntry: false,
      moduleIds: [],
      map: null,
      sourcemapFileName: `${importerAFile}.map`,
      preliminaryFileName: importerAFile,
    }

    const importerB: OutputChunk = {
      type: 'chunk',
      code: importerBCode,
      fileName: importerBFile,
      name: 'packageB/pages/home',
      modules: {},
      imports: [sharedFileName],
      dynamicImports: [],
      exports: [],
      isEntry: true,
      facadeModuleId: null,
      isDynamicEntry: false,
      moduleIds: [],
      map: null,
      sourcemapFileName: `${importerBFile}.map`,
      preliminaryFileName: importerBFile,
    }

    const bundle: OutputBundle = {
      [sharedFileName]: sharedChunk,
      [importerAFile]: importerA,
      [importerBFile]: importerB,
    }

    const emitted: Array<{ fileName: string, source: string }> = []
    const pluginContext = {
      pluginName: 'test',
      meta: {
        rollupVersion: '0',
        rolldownVersion: '0',
        watchMode: false,
      },
      emitFile: (file: { type: 'asset', fileName?: string, source: any }) => {
        if (file.type === 'asset' && file.fileName) {
          emitted.push({ fileName: file.fileName, source: String(file.source) })
          return file.fileName
        }
        return ''
      },
      * getModuleIds() {},
      getModuleInfo: () => null,
      addWatchFile: () => {},
      load: async () => {
        throw new Error('not implemented')
      },
      parse: () => {
        throw new Error('not implemented')
      },
      resolve: async () => null,
      fs: {} as any,
      getFileName: () => '',
      error: (e: any) => {
        throw (e instanceof Error ? e : new Error(String(e)))
      },
      warn: () => {},
      info: () => {},
      debug: () => {},
    } as unknown as PluginContext

    applySharedChunkStrategy.call(pluginContext, bundle, {
      strategy: 'duplicate',
      subPackageRoots: ['packageA', 'packageB'],
    })

    const packageAChunkName = `packageA/${SUB_PACKAGE_SHARED_DIR}/common.js`
    const packageBChunkName = `packageB/${SUB_PACKAGE_SHARED_DIR}/common.js`

    expect(emitted.map(file => file.fileName)).toEqual(
      expect.arrayContaining([packageAChunkName, packageBChunkName]),
    )
    expect(sharedChunk.code).toContain('duplicated into sub-packages')

    expect(bundle[importerAFile]?.imports).toContain(packageAChunkName)
    expect(bundle[importerBFile]?.imports).toContain(packageBChunkName)

    const importPattern = new RegExp(`require\\((['\`])(?:\\.\\/|\\.\\.\\/)${SUB_PACKAGE_SHARED_DIR}/common.js\\1\\)`)
    expect(bundle[importerAFile]?.code).toMatch(importPattern)
    expect(bundle[importerBFile]?.code).toMatch(importPattern)
  })
})
