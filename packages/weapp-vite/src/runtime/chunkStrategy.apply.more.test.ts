import type { OutputBundle, OutputChunk, PluginContext } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { applyRuntimeChunkLocalization, applySharedChunkStrategy, SHARED_CHUNK_VIRTUAL_PREFIX, SUB_PACKAGE_SHARED_DIR } from './chunkStrategy'

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
  it('throws when runtime localization is called without plugin context', () => {
    expect(() => applyRuntimeChunkLocalization.call(undefined as any, {} as OutputBundle, {
      subPackageRoots: ['pages/order'],
    })).toThrow('applyRuntimeChunkLocalization 需要 PluginContext。')
  })

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

    const importerWithScriptSet = createChunk(
      'pages/order/script-set.js',
      'require("../../rolldown-runtime.js");',
      [],
    )
    ;(importerWithScriptSet as any).viteMetadata = {
      importedScripts: new Set([runtimeFileName]),
    }

    const bundle: OutputBundle = {
      [runtimeLookupKey]: runtimeChunk,
      [importerWithSet.fileName]: importerWithSet,
      [importerWithArray.fileName]: importerWithArray,
      [importerWithMap.fileName]: importerWithMap,
      [importerWithCodeFallback.fileName]: importerWithCodeFallback,
      [importerWithScriptSet.fileName]: importerWithScriptSet,
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
      importerWithScriptSet.fileName,
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
          'pages/order/script-set.js',
        ]),
      },
    ])
  })

  it('returns early when runtime bundle entry is missing or source is not serializable string input', () => {
    const noRuntimeBundle: OutputBundle = {
      'pages/order/index.js': createChunk(
        'pages/order/index.js',
        'require("../../rolldown-runtime.js");',
        ['rolldown-runtime.js'],
      ),
    }
    const noRuntimeEmitted: Array<{ fileName: string, source: string }> = []
    const noRuntimeEvents: Array<{ runtimeFileName: string }> = []

    applyRuntimeChunkLocalization.call(createPluginContext(noRuntimeEmitted), noRuntimeBundle, {
      subPackageRoots: ['pages/order'],
      runtimeFileName: 'rolldown-runtime.js',
      onDuplicate: payload => noRuntimeEvents.push(payload),
    })

    expect(noRuntimeEmitted).toEqual([])
    expect(noRuntimeEvents).toEqual([])

    const objectRuntimeBundle: OutputBundle = {
      'rolldown-runtime.js': {
        type: 'asset',
        fileName: 'rolldown-runtime.js',
        source: {
          toString: () => '// runtime from object',
        },
      } as any,
      'pages/order/index.js': createChunk(
        'pages/order/index.js',
        'require("../../rolldown-runtime.js");',
        ['rolldown-runtime.js'],
      ),
    }
    const objectRuntimeEmitted: Array<{ fileName: string, source: string }> = []

    applyRuntimeChunkLocalization.call(createPluginContext(objectRuntimeEmitted), objectRuntimeBundle, {
      subPackageRoots: ['pages/order'],
      runtimeFileName: 'rolldown-runtime.js',
    })

    expect(objectRuntimeEmitted).toEqual([
      {
        fileName: 'pages/order/rolldown-runtime.js',
        source: '// runtime from object',
      },
    ])

    const emptyRuntimeSourceBundle: OutputBundle = {
      'rolldown-runtime.js': {
        type: 'asset',
        fileName: 'rolldown-runtime.js',
        source: null,
      } as any,
      'pages/order/index.js': createChunk(
        'pages/order/index.js',
        'require("../../rolldown-runtime.js");',
        ['rolldown-runtime.js'],
      ),
    }
    const emptyRuntimeSourceEmitted: Array<{ fileName: string, source: string }> = []

    applyRuntimeChunkLocalization.call(createPluginContext(emptyRuntimeSourceEmitted), emptyRuntimeSourceBundle, {
      subPackageRoots: ['pages/order'],
      runtimeFileName: 'rolldown-runtime.js',
    })

    expect(emptyRuntimeSourceEmitted).toEqual([])
  })

  it('returns early when sub-package roots are empty after normalization', () => {
    const bundle: OutputBundle = {
      'rolldown-runtime.js': createChunk('rolldown-runtime.js', '// runtime'),
      'pages/order/index.js': createChunk(
        'pages/order/index.js',
        'require("../../rolldown-runtime.js");',
        ['rolldown-runtime.js'],
      ),
    }
    const emitted: Array<{ fileName: string, source: string }> = []
    const duplicateEvents: Array<{ runtimeFileName: string }> = []

    applyRuntimeChunkLocalization.call(createPluginContext(emitted), bundle, {
      subPackageRoots: [''],
      onDuplicate: payload => duplicateEvents.push(payload),
    })

    expect(emitted).toEqual([])
    expect(duplicateEvents).toEqual([])
  })

  it('returns without localization when sub-package chunks do not reference runtime', () => {
    const bundle: OutputBundle = {
      'rolldown-runtime.js': createChunk('rolldown-runtime.js', '// runtime'),
      'pages/order/index.js': createChunk(
        'pages/order/index.js',
        'const a = require("../shared.js");',
        ['pages/shared.js'],
      ),
      'app.js': createChunk(
        'app.js',
        'require("./rolldown-runtime.js");',
        ['rolldown-runtime.js'],
      ),
    }
    const emitted: Array<{ fileName: string, source: string }> = []
    const duplicateEvents: Array<{ runtimeFileName: string }> = []

    applyRuntimeChunkLocalization.call(createPluginContext(emitted), bundle, {
      subPackageRoots: ['pages/order'],
      onDuplicate: payload => duplicateEvents.push(payload),
    })

    expect(emitted).toEqual([])
    expect(duplicateEvents).toEqual([])
    expect(bundle['pages/order/index.js']?.type).toBe('chunk')
    if (bundle['pages/order/index.js']?.type === 'chunk') {
      expect(bundle['pages/order/index.js'].imports).toEqual(['pages/shared.js'])
    }
  })

  it('localizes runtime for force roots even when sub-package chunks do not reference runtime', () => {
    const bundle: OutputBundle = {
      'rolldown-runtime.js': createChunk('rolldown-runtime.js', '// runtime'),
      'pages/order/index.js': createChunk(
        'pages/order/index.js',
        'const a = require("../shared.js");',
        ['pages/shared.js'],
      ),
    }
    const emitted: Array<{ fileName: string, source: string }> = []
    const duplicateEvents: Array<{ runtimeFileName: string, duplicates: Array<{ fileName: string, importers: string[] }> }> = []

    applyRuntimeChunkLocalization.call(createPluginContext(emitted), bundle, {
      subPackageRoots: ['pages/order'],
      forceRoots: ['pages/order'],
      onDuplicate: payload => duplicateEvents.push(payload),
    })

    expect(emitted).toEqual([
      {
        fileName: 'pages/order/rolldown-runtime.js',
        source: '// runtime',
      },
    ])
    expect(duplicateEvents).toEqual([
      {
        runtimeFileName: 'rolldown-runtime.js',
        duplicates: [
          {
            fileName: 'pages/order/rolldown-runtime.js',
            importers: [],
          },
        ],
      },
    ])
    expect(bundle['pages/order/index.js']?.type).toBe('chunk')
    if (bundle['pages/order/index.js']?.type === 'chunk') {
      expect(bundle['pages/order/index.js'].imports).toEqual(['pages/shared.js'])
      expect(bundle['pages/order/index.js'].code).toContain('require("../shared.js")')
    }
  })

  it('resolves runtime bundle record by basename when direct key is absent', () => {
    const runtimeFileName = 'rolldown-runtime.js'
    const runtimeLookupKey = 'assets/chunks/runtime-hash.js'
    const runtimeChunk = {
      ...createChunk(runtimeLookupKey, '// aliased runtime'),
      fileName: 'assets/chunks/rolldown-runtime.js',
      name: 'runtime',
      isEntry: false,
    } as OutputChunk

    const subPackageImporter = createChunk(
      'pages/order/index.js',
      'require("../../assets/chunks/runtime-hash.js");',
      [runtimeLookupKey],
    )

    const mainImporter = createChunk(
      'app.js',
      'require("./assets/chunks/runtime-hash.js");',
      [runtimeLookupKey],
    )

    const bundle: OutputBundle = {
      'broken.js': undefined as any,
      'assets/not-runtime.js': createChunk(
        'assets/not-runtime.js',
        'console.log("not runtime")',
        [],
      ),
      [runtimeLookupKey]: runtimeChunk,
      [subPackageImporter.fileName]: subPackageImporter,
      [mainImporter.fileName]: mainImporter,
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
        source: '// aliased runtime',
      },
    ])

    const localizedChunk = bundle[subPackageImporter.fileName]
    expect(localizedChunk?.type).toBe('chunk')
    if (localizedChunk?.type === 'chunk') {
      expect(localizedChunk.code).toContain('require("./rolldown-runtime.js")')
      expect(localizedChunk.imports).toContain('pages/order/rolldown-runtime.js')
      expect(localizedChunk.imports).not.toContain(runtimeLookupKey)
    }

    const rootChunk = bundle[mainImporter.fileName]
    expect(rootChunk?.type).toBe('chunk')
    if (rootChunk?.type === 'chunk') {
      expect(rootChunk.code).toContain('require("./assets/chunks/runtime-hash.js")')
      expect(rootChunk.imports).toContain(runtimeLookupKey)
    }

    expect(duplicateEvents).toHaveLength(1)
    expect(duplicateEvents[0]).toEqual({
      runtimeFileName,
      duplicates: [
        {
          fileName: 'pages/order/rolldown-runtime.js',
          importers: ['pages/order/index.js'],
        },
      ],
    })
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

  it('uses incremental file names when cross-subpackage duplicate targets already exist', () => {
    const sourceSharedFile = 'packageB/common.js'
    const sourceChunk = createChunk(sourceSharedFile, 'module.exports = 1', [])
    sourceChunk.isEntry = false

    const importerFile = 'packageA/pages/index.js'
    const importerChunk = createChunk(
      importerFile,
      'const shared = require("../../packageB/common.js")',
      [sourceSharedFile],
    )

    const reservedCollisionFile = `packageA/${SUB_PACKAGE_SHARED_DIR}/packageB.common.js`
    const bundle: OutputBundle = {
      [sourceSharedFile]: sourceChunk,
      [importerFile]: importerChunk,
      [reservedCollisionFile]: createChunk(reservedCollisionFile, 'module.exports = "reserved"', []),
    }

    const emitted: Array<{ fileName: string, source: string }> = []
    const duplicateEvents: Array<{ sharedFileName: string, duplicates: Array<{ fileName: string }> }> = []

    applySharedChunkStrategy.call(createPluginContext(emitted), bundle, {
      strategy: 'duplicate',
      subPackageRoots: ['packageA', 'packageB'],
      onDuplicate: payload => duplicateEvents.push(payload),
    })

    expect(emitted).toEqual([
      {
        fileName: `packageA/${SUB_PACKAGE_SHARED_DIR}/packageB.common.1.js`,
        source: 'module.exports = 1',
      },
    ])

    const rewrittenImporter = bundle[importerFile]
    expect(rewrittenImporter?.type).toBe('chunk')
    if (rewrittenImporter?.type === 'chunk') {
      expect(rewrittenImporter.imports).toContain(`packageA/${SUB_PACKAGE_SHARED_DIR}/packageB.common.1.js`)
      expect(rewrittenImporter.code).toContain(`require("../${SUB_PACKAGE_SHARED_DIR}/packageB.common.1.js")`)
    }

    expect(duplicateEvents).toHaveLength(1)
    expect(duplicateEvents[0].sharedFileName).toBe(sourceSharedFile)
    expect(duplicateEvents[0].duplicates).toEqual([
      {
        fileName: `packageA/${SUB_PACKAGE_SHARED_DIR}/packageB.common.1.js`,
        importers: [importerFile],
      },
    ])
  })

  it('keeps root path-shared chunks on the root runtime when sub-package pages import them', () => {
    const runtimeFileName = 'rolldown-runtime.js'
    const runtimeChunk = createChunk(runtimeFileName, 'exports.__commonJSMin = () => "runtime";')
    runtimeChunk.isEntry = false

    const rootSharedChunk = createChunk(
      'issue-340-shared.js',
      [
        'const runtime = require("./rolldown-runtime.js");',
        'const factory = runtime.__commonJSMin ? runtime.__commonJSMin : runtime.t;',
        'exports.shared = factory;',
      ].join(''),
      [runtimeFileName],
    )
    rootSharedChunk.isEntry = false

    const subpackageEntry = createChunk(
      'subpackages/user/register/form.js',
      'const shared = require("../../../issue-340-shared.js");exports.page = shared;',
      ['issue-340-shared.js'],
    )

    const bundle: OutputBundle = {
      [runtimeFileName]: runtimeChunk,
      [rootSharedChunk.fileName]: rootSharedChunk,
      [subpackageEntry.fileName]: subpackageEntry,
    }

    const emitted: Array<{ fileName: string, source: string }> = []
    const duplicateEvents: Array<{ runtimeFileName: string, duplicates: Array<{ fileName: string }> }> = []

    applyRuntimeChunkLocalization.call(createPluginContext(emitted), bundle, {
      subPackageRoots: ['subpackages/user'],
      runtimeFileName,
      onDuplicate: payload => duplicateEvents.push(payload),
    })

    expect(emitted).toEqual([])
    expect(duplicateEvents).toEqual([])

    const retainedSharedChunk = bundle[rootSharedChunk.fileName]
    expect(retainedSharedChunk?.type).toBe('chunk')
    if (retainedSharedChunk?.type === 'chunk') {
      expect(retainedSharedChunk.code).toContain('require("./rolldown-runtime.js")')
      expect(retainedSharedChunk.imports).toContain(runtimeFileName)
    }

    const retainedSubpackageEntry = bundle[subpackageEntry.fileName]
    expect(retainedSubpackageEntry?.type).toBe('chunk')
    if (retainedSubpackageEntry?.type === 'chunk') {
      expect(retainedSubpackageEntry.code).toContain('require("../../../issue-340-shared.js")')
      expect(retainedSubpackageEntry.code).not.toContain('rolldown-runtime.js')
    }
  })

  it('localizes nested cross-subpackage imports inside duplicated shared assets', () => {
    const sharedVirtualChunk = createChunk(
      `${SHARED_CHUNK_VIRTUAL_PREFIX}/pages_user/common.js`,
      'const orderShared = require("../../order/common.js"); exports.format = orderShared.b();',
      ['pages/order/common.js'],
    )
    sharedVirtualChunk.isEntry = false

    const orderCommonChunk = createChunk(
      'pages/order/common.js',
      'const root = require("../../common.js"); exports.b = () => root;',
      ['common.js'],
    )
    orderCommonChunk.isEntry = false

    const userImporter = createChunk(
      'pages/user/person-info/index.js',
      'const shared = require("../weapp-shared/common.js");',
      [`${SHARED_CHUNK_VIRTUAL_PREFIX}/pages_user/common.js`],
    )

    const bundle: OutputBundle = {
      [sharedVirtualChunk.fileName]: sharedVirtualChunk,
      [orderCommonChunk.fileName]: orderCommonChunk,
      [userImporter.fileName]: userImporter,
    }

    const emitted: Array<{ fileName: string, source: string }> = []

    applySharedChunkStrategy.call(createPluginContext(emitted), bundle, {
      strategy: 'duplicate',
      subPackageRoots: ['pages/order', 'pages/user'],
    })

    expect(emitted).toContainEqual({
      fileName: 'pages/user/weapp-shared/common.js',
      source: 'const orderShared = require("./pages_order.common.js"); exports.format = orderShared.b();',
    })
    expect(emitted).toContainEqual({
      fileName: 'pages/user/weapp-shared/pages_order.common.js',
      source: 'const root = require("../../../common.js"); exports.b = () => root;',
    })
  })
})
