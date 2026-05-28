import { describe, expect, it, vi } from 'vitest'
import { createAutoImportAugmenter } from './autoImport'

describe('createAutoImportAugmenter', () => {
  it('injects usingComponents when tag name matches resolver key', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'Navbar') {
        return {
          value: {
            name: 'Navbar',
            from: '/components/Navbar/index',
          },
        }
      }
      return undefined
    })

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ Navbar: [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({ Navbar: [{ start: 0, end: 0 }] })),
      } as any,
    )

    const json: Record<string, any> = {}
    const injectedEntries = applyAutoImports('/project/src/pages/index/index', json)

    expect(resolve).toHaveBeenCalledWith('Navbar', '/project/src/pages/index/index')
    expect(json.usingComponents).toEqual({
      Navbar: '/components/Navbar/index',
    })
    expect(injectedEntries).toEqual(['/components/Navbar/index'])
  })

  it('does not inject usingComponents when tag name case mismatches', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'navbar') {
        return {
          value: {
            name: 'navbar',
            from: '/components/navbar/index',
          },
        }
      }
      return undefined
    })

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ Navbar: [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({ Navbar: [{ start: 0, end: 0 }] })),
      } as any,
    )

    const json: Record<string, any> = {}
    const injectedEntries = applyAutoImports('/project/src/pages/index/index', json)

    expect(resolve).toHaveBeenCalledWith('Navbar', '/project/src/pages/index/index')
    expect(json.usingComponents).toBeUndefined()
    expect(injectedEntries).toEqual([])
  })

  it('injects usingComponents from imported template components', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'van-button') {
        return {
          value: {
            name: 'van-button',
            from: '/miniprogram_npm/@vant/weapp/button/index',
          },
        }
      }
      return undefined
    })

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ 'van-button': [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({ 'van-button': [{ start: 0, end: 0 }] })),
      } as any,
    )

    const json: Record<string, any> = {}
    applyAutoImports('/project/src/pages/index/index', json)

    expect(resolve).toHaveBeenCalledWith('van-button', '/project/src/pages/index/index')
    expect(json.usingComponents).toEqual({
      'van-button': '/miniprogram_npm/@vant/weapp/button/index',
    })
  })

  it('tracks resolver resolvedId so external Vue components join the compile flow', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'ResolverBadge') {
        return {
          value: {
            name: 'ResolverBadge',
            from: '/__weapp_vite_external__/resolver-ui/ResolverBadge',
            resolvedId: '/workspace/packages/resolver-ui/ResolverBadge.vue',
          },
        }
      }
      return undefined
    })
    const externalComponentEntryMap = new Map<string, string>()

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ ResolverBadge: [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({ ResolverBadge: [{ start: 0, end: 0 }] })),
      } as any,
      externalComponentEntryMap,
    )

    const json: Record<string, any> = {}
    const injectedEntries = applyAutoImports('/project/src/pages/index/index', json)

    expect(json.usingComponents).toEqual({
      ResolverBadge: '/__weapp_vite_external__/resolver-ui/ResolverBadge',
    })
    expect(injectedEntries).toEqual(['/__weapp_vite_external__/resolver-ui/ResolverBadge'])
    expect(externalComponentEntryMap.get('__weapp_vite_external__/resolver-ui/ResolverBadge')).toBe(
      '/workspace/packages/resolver-ui/ResolverBadge.vue',
    )
  })

  it('reuses resolved auto imports when aggregated template graph and version are unchanged', () => {
    const hit = { 'van-button': [{ start: 0, end: 0 }] }
    const resolve = vi.fn(() => {
      return {
        value: {
          name: 'van-button',
          from: '/miniprogram_npm/@vant/weapp/button/index',
        },
      }
    })
    const getVersion = vi.fn(() => 0)
    const getAggregatedAutoImportComponents = vi.fn(() => hit)
    const getAggregatedComponents = vi.fn(() => hit)

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion } as any,
      { getAggregatedAutoImportComponents, getAggregatedComponents } as any,
    )

    const firstJson: Record<string, any> = {}
    const secondJson: Record<string, any> = {}

    applyAutoImports('/project/src/pages/index/index', firstJson)
    applyAutoImports('/project/src/pages/index/index', secondJson)

    expect(resolve).toHaveBeenCalledTimes(1)
    expect(secondJson.usingComponents).toEqual({
      'van-button': '/miniprogram_npm/@vant/weapp/button/index',
    })
  })

  it('prefers auto-import candidates so builtin-name local components still resolve to user component', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'list-view') {
        return {
          value: {
            name,
            from: '/components/list-view/index',
          },
        }
      }
      return undefined
    })

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ 'list-view': [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({})),
      } as any,
    )

    const json: Record<string, any> = {}
    applyAutoImports('/project/src/pages/index/index', json)

    expect(resolve).toHaveBeenCalledWith('list-view', '/project/src/pages/index/index')
    expect(json.usingComponents).toEqual({
      'list-view': '/components/list-view/index',
    })
  })
})
