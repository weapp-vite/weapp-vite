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
    expect(asset.size).toBeGreaterThan(0)
    expect(asset.gzipSize).toBeGreaterThan(0)
    expect(asset.brotliSize).toBeGreaterThan(0)
  })
})
