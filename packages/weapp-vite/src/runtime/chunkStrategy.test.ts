import type { OutputBundle, OutputChunk } from 'rolldown'
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

    applySharedChunkStrategy(bundle, {
      strategy: 'duplicate',
      subPackageRoots: ['packageA', 'packageB'],
    })

    const packageAChunkName = `packageA/${SUB_PACKAGE_SHARED_DIR}/common.js`
    const packageBChunkName = `packageB/${SUB_PACKAGE_SHARED_DIR}/common.js`

    expect(bundle[sharedFileName]).toBeUndefined()
    expect(bundle[packageAChunkName]).toBeDefined()
    expect(bundle[packageBChunkName]).toBeDefined()

    expect(bundle[importerAFile]?.imports).toContain(packageAChunkName)
    expect(bundle[importerBFile]?.imports).toContain(packageBChunkName)

    expect(bundle[importerAFile]?.code).toContain(`require('./${SUB_PACKAGE_SHARED_DIR}/common.js')`)
    expect(bundle[importerBFile]?.code).toContain(`require('./${SUB_PACKAGE_SHARED_DIR}/common.js')`)
  })
})
