import type { OutputBundle, OutputChunk } from 'rolldown'
import { describe, expect, it, vi } from 'vitest'
import { ensureUniqueFileName, findChunkImporters, updateImporters } from './bundle'

function createChunk(fileName: string, overrides: Partial<OutputChunk> = {}): OutputChunk {
  return {
    type: 'chunk',
    fileName,
    code: '',
    name: fileName.replace(/\.js$/, '').replace(/\//g, '_'),
    modules: {},
    imports: [],
    dynamicImports: [],
    exports: [],
    isEntry: false,
    facadeModuleId: null,
    isDynamicEntry: false,
    moduleIds: [],
    map: null,
    sourcemapFileName: `${fileName}.map`,
    preliminaryFileName: fileName,
    ...overrides,
  }
}

describe('chunkStrategy bundle', () => {
  it('finds importers from imports, vite metadata and code fallback', () => {
    const bundle: OutputBundle = {
      'asset.txt': {
        type: 'asset',
        fileName: 'asset.txt',
        source: '',
      } as any,
      'pages/static.js': createChunk('pages/static.js', {
        imports: ['chunks/target.js'],
      }),
      'pages/dynamic.js': createChunk('pages/dynamic.js', {
        dynamicImports: ['chunks/target.js'],
      }),
      'pages/meta-set.js': createChunk('pages/meta-set.js', {
        viteMetadata: {
          importedChunks: new Set(['chunks/target.js']),
        } as any,
      } as any),
      'pages/meta-map.js': createChunk('pages/meta-map.js', {
        viteMetadata: {
          importedScripts: new Map([['chunks/target.js', true]]),
        } as any,
      } as any),
      'pages/meta-by-url.js': createChunk('pages/meta-by-url.js', {
        viteMetadata: {
          importedScriptsByUrl: ['chunks/target.js'],
        } as any,
      } as any),
      'pages/code.js': createChunk('pages/code.js', {
        code: `import "../chunks/target.js";`,
      }),
      'pages/miss.js': createChunk('pages/miss.js', {
        code: `import "./other.js";`,
      }),
    }

    const importers = findChunkImporters(bundle, 'chunks/target.js')
    expect(new Set(importers)).toEqual(new Set([
      'pages/static.js',
      'pages/dynamic.js',
      'pages/meta-set.js',
      'pages/meta-map.js',
      'pages/meta-by-url.js',
      'pages/code.js',
    ]))
  })

  it('ensures unique file name with and without directory segment', () => {
    const bundle: OutputBundle = {
      'a.js': createChunk('a.js'),
      'a.1.js': createChunk('a.1.js'),
      'chunks/a.js': createChunk('chunks/a.js'),
      'chunks/a.1.js': createChunk('chunks/a.1.js'),
    }

    expect(ensureUniqueFileName(bundle, 'missing.js')).toBe('missing.js')
    expect(ensureUniqueFileName(bundle, 'a.js')).toBe('a.2.js')
    expect(ensureUniqueFileName(bundle, 'chunks/a.js')).toBe('chunks/a.2.js')
  })

  it('updates importer code, arrays and vite metadata in multiple shapes', () => {
    const homeChunk = createChunk('pages/home.js', {
      code: `import "../chunks/shared.js";`,
      imports: ['chunks/shared.js', 'chunks/keep.js'],
      dynamicImports: ['chunks/lazy.js'],
      viteMetadata: {
        importedChunks: new Set(['chunks/shared.js']),
        importedScripts: ['chunks/external.js'],
      } as any,
    } as any)
    ;(homeChunk as any).implicitlyLoadedBefore = ['chunks/shared.js']
    ;(homeChunk as any).referencedFiles = ['chunks/ref.js']

    const adminChunk = createChunk('pages/admin.js', {
      imports: ['chunks/keep.js'],
      dynamicImports: undefined as any,
      viteMetadata: {
        importedChunks: new Map([['chunks/shared.js', { note: 'kept' }]]),
        importedScripts: new Map([['chunks/other.js', { note: 'untouched' }]]),
      } as any,
    } as any)

    const sameChunk = createChunk('pages/same.js', {
      code: `import "../chunks/shared.js";`,
      imports: ['chunks/shared.js'],
    })

    const bundle: OutputBundle = {
      'pages/home.js': homeChunk,
      'pages/admin.js': adminChunk,
      'pages/same.js': sameChunk,
      'asset.txt': {
        type: 'asset',
        fileName: 'asset.txt',
        source: '',
      } as any,
    }

    updateImporters(
      bundle,
      new Map([
        ['pages/home.js', 'chunks/shared.1.js'],
        ['pages/admin.js', 'chunks/shared.1.js'],
        ['pages/same.js', 'chunks/shared.js'],
        ['asset.txt', 'chunks/shared.1.js'],
        ['pages/missing.js', 'chunks/shared.1.js'],
      ]),
      'chunks/shared.js',
    )

    expect(homeChunk.code).toContain('../chunks/shared.1.js')
    expect(homeChunk.imports).toEqual(['chunks/shared.1.js', 'chunks/keep.js'])
    expect(homeChunk.dynamicImports).toEqual(['chunks/lazy.js', 'chunks/shared.1.js'])
    expect((homeChunk as any).implicitlyLoadedBefore).toEqual(['chunks/shared.1.js'])
    expect((homeChunk as any).referencedFiles).toEqual(['chunks/ref.js', 'chunks/shared.1.js'])
    expect((homeChunk as any).viteMetadata.importedChunks).toEqual(new Set(['chunks/shared.1.js']))
    expect((homeChunk as any).viteMetadata.importedScripts).toEqual([
      'chunks/external.js',
      'chunks/shared.1.js',
    ])

    const adminMetaMap = (adminChunk as any).viteMetadata.importedChunks as Map<string, any>
    expect(Array.from(adminMetaMap.keys())).toEqual(['chunks/shared.1.js'])
    expect(adminMetaMap.get('chunks/shared.1.js')).toEqual({ note: 'kept' })
    expect(Array.from((adminChunk as any).viteMetadata.importedScripts.entries())).toEqual([
      ['chunks/other.js', { note: 'untouched' }],
    ])
    expect(adminChunk.dynamicImports).toEqual([])

    expect(sameChunk.code).toContain('../chunks/shared.js')
    expect(sameChunk.imports).toEqual(['chunks/shared.js'])
    expect(sameChunk.dynamicImports).toEqual([])
  })

  it('skips code fallback when relative import generation returns empty value', async () => {
    vi.resetModules()
    vi.doMock('./utils', () => ({
      containsImportSpecifier: () => true,
      createRelativeImport: () => '',
      hasInCollection: () => false,
      replaceAll: (source: string) => source,
    }))

    try {
      const { findChunkImporters: findChunkImportersWithMock } = await import('./bundle')
      const bundle: OutputBundle = {
        'pages/a.js': createChunk('pages/a.js', {
          code: 'import "../chunks/target.js";',
        }),
      }

      expect(findChunkImportersWithMock(bundle, 'chunks/target.js')).toEqual([])
    }
    finally {
      vi.doUnmock('./utils')
      vi.resetModules()
    }
  })

  it('ensures unique name through filename-only branch when parsed dir is empty', async () => {
    vi.resetModules()
    vi.doMock('pathe', () => ({
      posix: {
        parse: () => ({ dir: '', name: 'entry', ext: '.js' }),
        join: (dir: string, file: string) => `${dir}/${file}`,
      },
    }))

    try {
      const { ensureUniqueFileName: ensureUniqueFileNameWithMock } = await import('./bundle')
      const bundle: OutputBundle = {
        'entry.js': createChunk('entry.js'),
        'entry.1.js': createChunk('entry.1.js'),
      }
      expect(ensureUniqueFileNameWithMock(bundle, 'entry.js')).toBe('entry.2.js')
    }
    finally {
      vi.doUnmock('pathe')
      vi.resetModules()
    }
  })
})
