import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { TDesignResolver, VantResolver } from '../../auto-import-components/resolvers'
import { loadExternalComponentMetadata } from './externalMetadata'

describe('loadExternalComponentMetadata (cache)', () => {
  it('memoizes metadata per resolver array', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-meta-'))
    let readSpy: ReturnType<typeof vi.spyOn> | undefined
    try {
      await fs.outputJson(path.join(root, 'package.json'), { name: 'app', version: '0.0.0' })
      await fs.outputJson(path.join(root, 'node_modules/mock-lib/package.json'), { name: 'mock-lib', version: '0.0.0' })
      await fs.outputFile(
        path.join(root, 'node_modules/mock-lib/types.d.ts'),
        [
          'export interface MockProps {',
          '  size?: {',
          '    type: StringConstructor;',
          '    value?: string;',
          '  };',
          '}',
        ].join('\n'),
        'utf8',
      )

      const resolver = {
        resolveExternalMetadataCandidates() {
          return {
            packageName: 'mock-lib',
            dts: ['types.d.ts'],
            js: [],
          }
        },
      }

      const resolvers = [resolver]
      readSpy = vi.spyOn(fs, 'readFileSync')
      const first = loadExternalComponentMetadata('mock-lib/component', root, resolvers)
      const firstReads = readSpy.mock.calls.length
      const second = loadExternalComponentMetadata('mock-lib/component', root, resolvers)
      const secondReads = readSpy.mock.calls.length

      expect(first?.types.get('size')).toBe('string')
      expect(second).toBe(first)
      expect(secondReads).toBe(firstReads)
    }
    finally {
      readSpy?.mockRestore()
      await fs.remove(root)
    }
  })

  it('reuses package root resolution across components from the same package', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-meta-'))
    const packageRoot = path.join(root, 'node_modules/mock-lib')
    try {
      await fs.outputJson(path.join(root, 'package.json'), { name: 'app', version: '0.0.0' })
      await fs.outputJson(path.join(packageRoot, 'package.json'), { name: 'mock-lib', version: '0.0.0' })
      await fs.outputFile(
        path.join(packageRoot, 'button.d.ts'),
        [
          'export interface MockButtonProps {',
          '  size?: {',
          '    type: StringConstructor;',
          '    value?: string;',
          '  };',
          '}',
        ].join('\n'),
        'utf8',
      )
      await fs.outputFile(
        path.join(packageRoot, 'input.d.ts'),
        [
          'export interface MockInputProps {',
          '  value?: {',
          '    type: StringConstructor;',
          '    value?: string;',
          '  };',
          '}',
        ].join('\n'),
        'utf8',
      )

      vi.resetModules()
      const resolveSpy = vi.fn((request: string) => {
        if (request === 'mock-lib/package.json') {
          return path.join(packageRoot, 'package.json')
        }
        throw Object.assign(new Error(`Cannot resolve ${request}`), { code: 'MODULE_NOT_FOUND' })
      })
      vi.doMock('node:module', async (importOriginal) => {
        const actual = await importOriginal<typeof import('node:module')>()
        return {
          ...actual,
          createRequire: vi.fn((filename: string | URL) => {
            if (String(filename) === path.join(root, 'package.json')) {
              return {
                ...actual.createRequire(filename),
                resolve: resolveSpy,
              }
            }
            return actual.createRequire(filename)
          }),
        }
      })
      const { loadExternalComponentMetadata: loadWithMock } = await import('./externalMetadata')

      const resolver = {
        resolveExternalMetadataCandidates(from: string) {
          return {
            packageName: 'mock-lib',
            dts: [from.endsWith('/input') ? 'input.d.ts' : 'button.d.ts'],
            js: [],
          }
        },
      }
      const resolvers = [resolver]
      const button = loadWithMock('mock-lib/button', root, resolvers)
      const input = loadWithMock('mock-lib/input', root, resolvers)
      const packageRootResolves = resolveSpy.mock.calls.filter(([request]) => request === 'mock-lib/package.json')

      expect(button?.types.get('size')).toBe('string')
      expect(input?.types.get('value')).toBe('string')
      expect(packageRootResolves).toHaveLength(1)
    }
    finally {
      vi.doUnmock('node:module')
      vi.resetModules()
      await fs.remove(root)
    }
  })

  it('skips metadata candidates under missing package roots', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-meta-'))
    let readSpy: ReturnType<typeof vi.spyOn> | undefined
    try {
      await fs.outputJson(path.join(root, 'package.json'), { name: 'app', version: '0.0.0' })
      await fs.outputJson(path.join(root, 'node_modules/mock-lib/package.json'), { name: 'mock-lib', version: '0.0.0' })

      const resolver = {
        resolveExternalMetadataCandidates() {
          return {
            packageName: 'mock-lib',
            dts: ['lib/button/index.d.ts', 'dist/button/index.d.ts'],
            js: ['lib/button/index.js', 'dist/button/index.js'],
          }
        },
      }

      readSpy = vi.spyOn(fs, 'readFileSync')
      const meta = loadExternalComponentMetadata('mock-lib/button', root, [resolver])

      expect(meta).toBeUndefined()
      expect(readSpy).not.toHaveBeenCalled()
    }
    finally {
      readSpy?.mockRestore()
      await fs.remove(root)
    }
  })
})

describe('loadExternalComponentMetadata (integration)', () => {
  it('loads props from tdesign-miniprogram type.d.ts', () => {
    const appCwd = path.resolve(import.meta.dirname, '../../../../../apps/wevu-comprehensive-demo')
    const meta = loadExternalComponentMetadata('tdesign-miniprogram/avatar/avatar', appCwd, [TDesignResolver()])
    expect(meta).toBeDefined()
    expect(meta!.types.size).toBeGreaterThan(0)
    expect(meta!.types.get('size')).toBeDefined()
  })

  it('loads props from @vant/weapp dts', () => {
    const appCwd = path.resolve(import.meta.dirname, '../../../../../apps/wevu-comprehensive-demo')
    const meta = loadExternalComponentMetadata('@vant/weapp/button', appCwd, [VantResolver()])
    expect(meta).toBeDefined()
    expect(meta!.types.size).toBeGreaterThan(0)
  })
})
