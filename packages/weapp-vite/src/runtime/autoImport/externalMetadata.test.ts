import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { TDesignResolver, VantResolver } from '../../auto-import-components/resolvers'
import { loadExternalComponentMetadata } from './externalMetadata'

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
