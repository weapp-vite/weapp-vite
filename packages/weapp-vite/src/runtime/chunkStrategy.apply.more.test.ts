import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { applyRuntimeChunkLocalization, applySharedChunkStrategy, SUB_PACKAGE_SHARED_DIR } from './chunkStrategy'

function createChunk(fileName: string, code: string, imports: string[] = []): OutputChunk {
  return {
    type: 'chunk',
    code,
    fileName,
    name: fileName.replace(/\.js$/, '').replace(/\//g, '_'),
    modules: {},
    imports,
    dynamicImports: [],
    exports: [],
    isEntry: true,
    facadeModuleId: null,
    isDynamicEntry: false,
    moduleIds: [],
    map: null,
    sourcemapFileName: `${fileName}.map`,
    preliminaryFileName: fileName,
  }
}

function createPluginContext(emitted: Array<{ fileName: string, source: string }>) {
  return {
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
      throw new Error('未实现')
    },
    parse: () => {
      throw new Error('未实现')
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
}

describe('chunkStrategy apply helpers more branches', () => {
  it('detects runtime references from viteMetadata collections and runtime lookup aliases', () => {
    const runtimeFileName = 'rolldown-runtime.js'
    const runtimeLookupKey = 'assets/chunks/rolldown-runtime.js'

    const runtimeChunk = {
      ...createChunk('', '// runtime chunk'),
      fileName: '',
      name: 'runtime',
      isEntry: false,
    } as OutputChunk

    const importerWithSet = createChunk(
      'pages/order/set.js',
      'require("../../assets/chunks/rolldown-runtime.js");',
      [],
    )
    ;(importerWithSet as any).viteMetadata = {
      importedChunks: new Set([runtimeLookupKey]),
    }

    const importerWithArray = createChunk(
      'pages/order/array.js',
      'require("../../rolldown-runtime.js");',
      [],
    )
    ;(importerWithArray as any).viteMetadata = {
      importedChunks: [runtimeFileName],
    }

    const importerWithMap = createChunk(
      'pages/order/map.js',
      'require("../../assets/chunks/rolldown-runtime.js");',
      [],
    )
    ;(importerWithMap as any).viteMetadata = {
      importedScripts: new Map([[runtimeLookupKey, true]]),
    }

    const importerWithCodeFallback = createChunk(
      'pages/order/code.js',
      'require("../../rolldown-runtime.js");',
      [],
    )
    ;(importerWithCodeFallback as any).viteMetadata = {
      importedScriptsByUrl: {
        [runtimeFileName]: true,
      },
    }

    const bundle: OutputBundle = {
      [runtimeLookupKey]: runtimeChunk,
      [importerWithSet.fileName]: importerWithSet,
      [importerWithArray.fileName]: importerWithArray,
      [importerWithMap.fileName]: importerWithMap,
      [importerWithCodeFallback.fileName]: importerWithCodeFallback,
    }

    const emitted: Array<{ fileName: string, source: string }> = []
    const duplicateEvents: Array<{ runtimeFileName: string, duplicates: Array<{ fileName: string }> }> = []

    applyRuntimeChunkLocalization.call(createPluginContext(emitted), bundle, {
      subPackageRoots: ['pages/order'],
      runtimeFileName,
      onDuplicate: payload => duplicateEvents.push(payload),
    })

    expect(emitted).toEqual([
      {
        fileName: 'pages/order/rolldown-runtime.js',
        source: '// runtime chunk',
      },
    ])

    for (const fileName of [
      importerWithSet.fileName,
      importerWithArray.fileName,
      importerWithMap.fileName,
      importerWithCodeFallback.fileName,
    ]) {
      const chunk = bundle[fileName]
      expect(chunk?.type).toBe('chunk')
      if (chunk?.type === 'chunk') {
        expect(chunk.code).toContain('require("./rolldown-runtime.js")')
        expect(chunk.imports).toContain('pages/order/rolldown-runtime.js')
      }
    }

    expect(duplicateEvents).toHaveLength(1)
    expect(duplicateEvents[0].runtimeFileName).toBe(runtimeFileName)
    expect(duplicateEvents[0].duplicates).toEqual([
      {
        fileName: 'pages/order/rolldown-runtime.js',
        importers: expect.arrayContaining([
          'pages/order/set.js',
          'pages/order/array.js',
          'pages/order/map.js',
          'pages/order/code.js',
        ]),
      },
    ])
  })

  it('keeps shared import specifier when source and target relative paths are identical', () => {
    const sourceChunkFile = 'packageB/weapp-shared/shared.js'
    const sourceChunk = createChunk(
      sourceChunkFile,
      'const shared = require("../../common.js")',
      ['common.js'],
    )
    sourceChunk.isEntry = false

    const crossImporterFile = 'packageA/pages/index.js'
    const crossImporter = createChunk(
      crossImporterFile,
      'const shared = require("../../packageB/weapp-shared/shared.js")',
      [sourceChunkFile],
    )

    const bundle: OutputBundle = {
      [sourceChunkFile]: sourceChunk,
      [crossImporterFile]: crossImporter,
    }

    const emitted: Array<{ fileName: string, source: string }> = []
    applySharedChunkStrategy.call(createPluginContext(emitted), bundle, {
      strategy: 'duplicate',
      subPackageRoots: ['packageA', 'packageB'],
    })

    const duplicatedFileName = `packageA/${SUB_PACKAGE_SHARED_DIR}/packageB.shared.js`
    const duplicated = emitted.find(item => item.fileName === duplicatedFileName)
    expect(duplicated).toBeDefined()
    expect(duplicated?.source).toContain('require("../../common.js")')

    const updatedImporter = bundle[crossImporterFile]
    expect(updatedImporter?.type).toBe('chunk')
    if (updatedImporter?.type === 'chunk') {
      expect(updatedImporter.imports).toContain(duplicatedFileName)
      expect(updatedImporter.code).toContain('require("../weapp-shared/packageB.shared.js")')
    }
  })
})
