import os from 'node:os'
import fs from 'fs-extra'
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
          '  properties: {',
          '    size: {',
          '      type: StringConstructor',
          '    }',
          '  }',
          '}',
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
