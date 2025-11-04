import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import type { SharedChunkDuplicatePayload } from './chunkStrategy'
import { Buffer } from 'node:buffer'
import { posix as path } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { __clearSharedChunkDiagnosticsForTest, applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY, resolveSharedChunkName, SHARED_CHUNK_VIRTUAL_PREFIX, SUB_PACKAGE_SHARED_DIR } from './chunkStrategy'

const ROOT = '/project/src'

type ImportGraph = Record<string, string[] | undefined | null>

function createCtx(graph: ImportGraph) {
  return {
    getModuleInfo: (id: string) => {
      if (id in graph) {
        const importers = graph[id]
        return importers ? { importers } : { importers: [] }
      }
      return { importers: [] }
    },
  }
}

afterEach(() => {
  __clearSharedChunkDiagnosticsForTest()
})

function relativeAbsoluteSrcRoot(id: string) {
  return id.replace(`${ROOT}/`, '')
}

describe('resolveSharedChunkName', () => {
  it('returns sub-package common chunk when only one prefix', () => {
    const graph: ImportGraph = {
      [`${ROOT}/utils.ts`]: [`${ROOT}/packageA/foo.ts`, `${ROOT}/packageA/bar.ts`],
    }
    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx(graph),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
    })

    expect(result).toBe('packageA/common')
  })

  it('在策略为 hoist 时会提炼到主包', () => {
    const graph: ImportGraph = {
      [`${ROOT}/utils.ts`]: [`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`],
    }
    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx(graph),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: 'hoist',
    })

    expect(result).toBe('common')
  })

  it('默认策略会将跨分包模块标记为复制', () => {
    const graph: ImportGraph = {
      [`${ROOT}/utils.ts`]: [`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`],
    }
    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx(graph),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
    })

    expect(result).toBe(`${SHARED_CHUNK_VIRTUAL_PREFIX}/packageA+packageB/common`)
  })

  it('still hoists when main package participates', () => {
    const graph: ImportGraph = {
      [`${ROOT}/utils.ts`]: [`${ROOT}/packageA/foo.ts`, `${ROOT}/app.ts`],
      [`${ROOT}/packageA/foo.ts`]: [],
      [`${ROOT}/app.ts`]: [],
    }
    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx(graph),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA'],
      strategy: 'duplicate',
    })

    expect(result).toBe('common')
  })

  it('ignores pseudo main importers that are only referenced by sub-packages', () => {
    const graph: ImportGraph = {
      [`${ROOT}/utils.ts`]: [
        `${ROOT}/packageA/foo.ts`,
        `${ROOT}/packageB/bar.ts`,
        `${ROOT}/action/test2.ts`,
      ],
      [`${ROOT}/packageA/foo.ts`]: [],
      [`${ROOT}/packageB/bar.ts`]: [],
      [`${ROOT}/action/test2.ts`]: [`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`],
    }

    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx(graph),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: 'duplicate',
    })

    expect(result).toBe(`${SHARED_CHUNK_VIRTUAL_PREFIX}/packageA+packageB/common`)
  })

  it('forceDuplicatePatterns allow overriding missing importer graphs', () => {
    const graph: ImportGraph = {
      [`${ROOT}/utils.ts`]: [
        `${ROOT}/packageA/foo.ts`,
        `${ROOT}/packageB/bar.ts`,
        `${ROOT}/action/test2.ts`,
      ],
      [`${ROOT}/packageA/foo.ts`]: [],
      [`${ROOT}/packageB/bar.ts`]: [],
      // test2.ts intentionally has no recorded importers
    }

    const result = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx: createCtx(graph),
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: 'duplicate',
      forceDuplicateTester: (relativeId, _absoluteId) => relativeId.startsWith('action/'),
    })

    expect(result).toBe(`${SHARED_CHUNK_VIRTUAL_PREFIX}/packageA+packageB/common`)
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
    const duplicateEvents: SharedChunkDuplicatePayload[] = []
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
      onDuplicate: (event) => {
        duplicateEvents.push(event)
      },
    })

    const packageAChunkName = `packageA/${SUB_PACKAGE_SHARED_DIR}/common.js`
    const packageBChunkName = `packageB/${SUB_PACKAGE_SHARED_DIR}/common.js`

    expect(emitted.map(file => file.fileName)).toEqual(
      expect.arrayContaining([packageAChunkName, packageBChunkName]),
    )
    expect(bundle[sharedFileName]).toBeUndefined()

    const importerAChunk = bundle[importerAFile]
    const importerBChunk = bundle[importerBFile]
    expect(importerAChunk?.type).toBe('chunk')
    expect(importerBChunk?.type).toBe('chunk')

    if (importerAChunk?.type === 'chunk') {
      expect(importerAChunk.imports).toContain(packageAChunkName)
      const importPattern = new RegExp(`require\\((['\`])(?:\\.\\/|\\.\\.\\/)${SUB_PACKAGE_SHARED_DIR}/common.js\\1\\)`)
      expect(importerAChunk.code).toMatch(importPattern)
    }

    if (importerBChunk?.type === 'chunk') {
      expect(importerBChunk.imports).toContain(packageBChunkName)
      const importPattern = new RegExp(`require\\((['\`])(?:\\.\\/|\\.\\.\\/)${SUB_PACKAGE_SHARED_DIR}/common.js\\1\\)`)
      expect(importerBChunk.code).toMatch(importPattern)
    }

    expect(duplicateEvents).toHaveLength(1)
    expect(duplicateEvents[0].sharedFileName).toBe(sharedFileName)
    expect(duplicateEvents[0].duplicates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: packageAChunkName,
          importers: expect.arrayContaining([importerAFile]),
        }),
        expect.objectContaining({
          fileName: packageBChunkName,
          importers: expect.arrayContaining([importerBFile]),
        }),
      ]),
    )
    const expectedChunkBytes = Buffer.byteLength(sharedChunk.code, 'utf8')
    expect(duplicateEvents[0].chunkBytes).toBe(expectedChunkBytes)
    expect(duplicateEvents[0].redundantBytes).toBe(expectedChunkBytes)
    expect(duplicateEvents[0].ignoredMainImporters).toBeUndefined()
  })

  it('handles multi-sub-package shared chunk without leaving virtual artifacts', () => {
    const sharedFileName = `${SHARED_CHUNK_VIRTUAL_PREFIX}/pages/index1_pages/index2_pages/index3/common.js`
    const sharedChunk: OutputChunk = {
      type: 'chunk',
      code: '// shared chunk duplicated into sub-packages',
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
      map: {
        version: 3,
        file: 'common.js',
        sources: ['common.ts'],
        names: [],
        mappings: '',
      } as any,
      sourcemapFileName: `${sharedFileName}.map`,
      preliminaryFileName: sharedFileName,
    }

    const importerFiles = [
      'pages/index1/index.js',
      'pages/index2/index.js',
      'pages/index3/index.js',
    ]
    const bundle: OutputBundle = {
      [sharedFileName]: sharedChunk,
      [`${sharedFileName}.map`]: {
        type: 'asset',
        source: '{"version":3,"sources":["common.ts"],"mappings":""}',
        name: undefined,
        needsCodeReference: false,
      } as any,
    }

    for (const importerFile of importerFiles) {
      bundle[importerFile] = {
        type: 'chunk',
        code: `require('../../${sharedFileName}')`,
        fileName: importerFile,
        name: importerFile.replace(/\.js$/, ''),
        modules: {},
        imports: [],
        dynamicImports: [],
        exports: [],
        isEntry: true,
        facadeModuleId: null,
        isDynamicEntry: false,
        moduleIds: [],
        map: null,
        sourcemapFileName: `${importerFile}.map`,
        preliminaryFileName: importerFile,
      }
    }

    const emitted: Array<{ fileName: string, source: string }> = []
    const duplicateEvents: SharedChunkDuplicatePayload[] = []
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
      subPackageRoots: ['pages/index1', 'pages/index2', 'pages/index3'],
      onDuplicate: (event) => {
        duplicateEvents.push(event)
      },
    })

    expect(Object.keys(bundle).some(name => name.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`))).toBe(false)
    expect(bundle[sharedFileName]).toBeUndefined()
    expect(bundle[`${sharedFileName}.map`]).toBeUndefined()

    const expectedDuplicates = importerFiles.map(importerFile => ({
      chunkName: `${path.dirname(importerFile)}/${SUB_PACKAGE_SHARED_DIR}/common.js`,
      importerFile,
    }))

    for (const { chunkName, importerFile } of expectedDuplicates) {
      const importerChunk = bundle[importerFile]
      expect(importerChunk?.type).toBe('chunk')
      if (importerChunk?.type === 'chunk') {
        expect(importerChunk.imports).toContain(chunkName)
        expect(importerChunk.code).toContain('./weapp-shared/common.js')
      }

      expect(emitted.map(item => item.fileName)).toContain(chunkName)
      expect(emitted.map(item => item.fileName)).toContain(`${chunkName}.map`)
    }

    expect(duplicateEvents).toHaveLength(1)
    const duplicate = duplicateEvents[0]
    expect(duplicate.duplicates).toHaveLength(3)
    expect(duplicate.sharedFileName).toBe(sharedFileName)
  })

  it('emits fallback event when main package participates', () => {
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
    const importerAppFile = 'app.js'
    const importerA: OutputChunk = {
      type: 'chunk',
      code: `require('../${sharedFileName}')`,
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

    const importerApp: OutputChunk = {
      type: 'chunk',
      code: `require('./${sharedFileName}')`,
      fileName: importerAppFile,
      name: 'app',
      modules: {},
      imports: [sharedFileName],
      dynamicImports: [],
      exports: [],
      isEntry: true,
      facadeModuleId: null,
      isDynamicEntry: false,
      moduleIds: [],
      map: null,
      sourcemapFileName: `${importerAppFile}.map`,
      preliminaryFileName: importerAppFile,
    }

    const bundle: OutputBundle = {
      [sharedFileName]: sharedChunk,
      [importerAFile]: importerA,
      [importerAppFile]: importerApp,
    }

    const fallbackEvents: Array<{ sharedFileName: string, finalFileName: string, reason: string, importers: string[] }> = []
    const pluginContext = {
      pluginName: 'test',
      meta: {
        rollupVersion: '0',
        rolldownVersion: '0',
        watchMode: false,
      },
      emitFile: () => '',
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
      onFallback: (event) => {
        fallbackEvents.push(event)
      },
    })

    expect(fallbackEvents).toHaveLength(1)
    expect(fallbackEvents[0].sharedFileName).toBe(sharedFileName)
    expect(fallbackEvents[0].reason).toBe('main-package')
    expect(fallbackEvents[0].finalFileName).toBe('packageA+packageB/common.js')
    expect(fallbackEvents[0].importers).toEqual(expect.arrayContaining([importerAFile, importerAppFile]))
  })

  it('propagates ignored main importers via duplicate callback', () => {
    const graph: ImportGraph = {
      [`${ROOT}/utils.ts`]: [
        `${ROOT}/packageA/foo.ts`,
        `${ROOT}/packageB/bar.ts`,
        `${ROOT}/action/test2.ts`,
      ],
      [`${ROOT}/packageA/foo.ts`]: [],
      [`${ROOT}/packageB/bar.ts`]: [],
      [`${ROOT}/action/test2.ts`]: [`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`],
    }

    const ctx = createCtx(graph)
    const sharedName = resolveSharedChunkName({
      id: `${ROOT}/utils.ts`,
      ctx,
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      strategy: 'duplicate',
    })

    expect(sharedName).toBe(`${SHARED_CHUNK_VIRTUAL_PREFIX}/packageA+packageB/common`)
    const sharedFileName = `${sharedName}.js`
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
    const importerA: OutputChunk = {
      type: 'chunk',
      code: `require('../${sharedFileName}')`,
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
      code: `require('../${sharedFileName}')`,
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

    const duplicateEvents: SharedChunkDuplicatePayload[] = []

    const pluginContext = {
      pluginName: 'test',
      meta: {
        rollupVersion: '0',
        rolldownVersion: '0',
        watchMode: false,
      },
      emitFile: () => '',
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
      onDuplicate: (event) => {
        duplicateEvents.push(event)
      },
    })

    expect(duplicateEvents).toHaveLength(1)
    expect(duplicateEvents[0].sharedFileName).toBe(sharedFileName)
    expect(duplicateEvents[0].ignoredMainImporters).toEqual(['action/test2.ts'])
  })
})
