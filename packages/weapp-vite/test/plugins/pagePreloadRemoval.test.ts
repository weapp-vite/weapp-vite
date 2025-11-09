import type { OutputBundle } from 'rolldown'
import type { Entry } from '@/types'
import { __removeImplicitPagePreloadsForTest } from '@/plugins/core'

function createBundle() {
  const bundle: OutputBundle = {
    'app.js': {
      type: 'chunk',
      fileName: 'app.js',
      code: [
        'const require_page = require(\'./pages/index/index.js\');',
        'const require_common = require(\'./common.js\');',
        'App({});',
      ].join('\n'),
      imports: ['pages/index/index.js', 'common.js'],
      dynamicImports: [],
      implicitlyLoadedBefore: ['pages/index/index.js'],
      exports: [],
      modules: {},
      facadeModuleId: '/project/src/app.ts',
      isEntry: true,
      isImplicitEntry: false,
      map: null,
      referencedFiles: [],
      renderedExports: [],
    } as any,
    'pages/index/index.js': {
      type: 'chunk',
      fileName: 'pages/index/index.js',
      code: 'Page({});',
      imports: [],
      dynamicImports: [],
      implicitlyLoadedBefore: [],
      exports: [],
      modules: {},
      facadeModuleId: '/project/src/pages/index/index.ts',
      isEntry: true,
      isImplicitEntry: false,
      map: null,
      referencedFiles: [],
      renderedExports: [],
    } as any,
  }
  return bundle
}

describe('removeImplicitPagePreloads', () => {
  const configService = {
    relativeAbsoluteSrcRoot(id: string) {
      return id.replace('/project/src/', '')
    },
  } as any

  const pageEntry: Entry = {
    type: 'page',
    path: '/project/src/pages/index/index.ts',
    templatePath: '/project/src/pages/index/index.wxml',
    jsonPath: '/project/src/pages/index/index.json',
    json: {},
  }

  it('strips injected requires that eagerly execute page chunks', () => {
    const bundle = createBundle()
    __removeImplicitPagePreloadsForTest(bundle, {
      configService,
      entriesMap: new Map([['pages/index/index', pageEntry]]),
    })

    const appChunk = bundle['app.js']!
    expect(appChunk.code).not.toContain('require(\'./pages/index/index.js\')')
    expect(appChunk.code).toContain('require(\'./common.js\')')
    expect(appChunk.imports).toEqual(['common.js'])
    expect((appChunk as any).implicitlyLoadedBefore).toEqual([])
  })

  it('skips removal when entry metadata is missing', () => {
    const bundle = createBundle()
    __removeImplicitPagePreloadsForTest(bundle, {
      configService,
      entriesMap: new Map(),
    })
    const appChunk = bundle['app.js']!
    expect(appChunk.code).toContain('require(\'./pages/index/index.js\')')
    expect(appChunk.imports).toContain('pages/index/index.js')
  })
})
