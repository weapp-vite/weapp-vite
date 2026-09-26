import type { RolldownOutput } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { processOutput } from './output'

function createMockContext() {
  return {
    configService: {
      absolutePluginRoot: undefined,
      absoluteSrcRoot: '/project/src',
      relativeAbsoluteSrcRoot: (value: string) => value.replace('/project/src/', ''),
    },
  } as any
}

describe('analyze subpackages output', () => {
  it('records gzip and brotli sizes for chunks and assets', () => {
    const packages = new Map()
    const modules = new Map()

    processOutput({
      output: [
        {
          type: 'chunk',
          fileName: 'app.js',
          code: 'const message = "hello dashboard";\n'.repeat(20),
          isEntry: true,
          imports: ['shared.js'],
          dynamicImports: ['lazy.js'],
          modules: {
            '/project/src/pages/index.ts': {
              renderedLength: 24,
              code: 'export const message = "hello dashboard"',
            },
          },
        },
        {
          type: 'asset',
          fileName: 'app.wxss',
          source: '.page { color: #111; }\n'.repeat(20),
        },
      ],
    } as unknown as RolldownOutput, 'main', createMockContext(), {
      subPackageRoots: new Set(),
      independentRoots: new Set(),
    }, packages, modules)

    const mainPackage = packages.get('__main__')
    const chunk = mainPackage.files.get('app.js')
    const asset = mainPackage.files.get('app.wxss')

    expect(chunk.size).toBeGreaterThan(0)
    expect(chunk.gzipSize).toBeGreaterThan(0)
    expect(chunk.brotliSize).toBeGreaterThan(0)
    expect(chunk.imports).toEqual(['shared.js'])
    expect(chunk.dynamicImports).toEqual(['lazy.js'])
    expect(asset.size).toBeGreaterThan(0)
    expect(asset.gzipSize).toBeGreaterThan(0)
    expect(asset.brotliSize).toBeGreaterThan(0)
  })

  it('attributes emitted plugin assets from their original source file', () => {
    const packages = new Map()
    const modules = new Map()
    const context = {
      configService: {
        absolutePluginRoot: '/project/plugin',
        absoluteSrcRoot: '/project/miniprogram',
        relativeAbsoluteSrcRoot: (value: string) => value
          .replace('/project/plugin/', 'plugin/')
          .replace('/project/miniprogram/', ''),
      },
    } as any

    processOutput({
      output: [
        {
          type: 'asset',
          fileName: 'plugin/components/card.wxss',
          originalFileNames: ['/project/plugin/components/card.wxss'],
          source: '.card {}',
        },
      ],
    } as unknown as RolldownOutput, 'main', context, {
      subPackageRoots: new Set(),
      independentRoots: new Set(),
    }, packages, modules)

    const asset = packages.get('__main__').files.get('plugin/components/card.wxss')
    expect(asset.source).toBe('plugin/components/card.wxss')
    expect(asset.sourceType).toBe('plugin')
  })

  it('captures finalized independent chunks and assets after reporting them', () => {
    const packages = new Map()
    const modules = new Map()
    const assetSource = new Uint8Array([123, 125])
    const captured: Array<[string, string | Uint8Array]> = []

    processOutput({
      output: [
        {
          type: 'chunk',
          fileName: 'packageA/pages/index.js',
          code: 'Page({})',
          isEntry: true,
          imports: [],
          dynamicImports: [],
          modules: {},
        },
        {
          type: 'asset',
          fileName: 'packageA/pages/index.json',
          source: assetSource,
        },
      ],
    } as unknown as RolldownOutput, 'independent', createMockContext(), {
      subPackageRoots: new Set(['packageA']),
      independentRoots: new Set(['packageA']),
    }, packages, modules, (fileName, source) => {
      expect(packages.get('packageA').files.has(fileName)).toBe(true)
      captured.push([fileName, source])
    })

    expect(captured).toEqual([
      ['packageA/pages/index.js', 'Page({})'],
      ['packageA/pages/index.json', assetSource],
    ])
  })
})
