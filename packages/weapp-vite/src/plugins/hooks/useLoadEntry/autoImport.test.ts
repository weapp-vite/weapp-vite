import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
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

  it('returns matching existing auto-import entries for force emit', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'HotCard') {
        return {
          value: {
            name: 'HotCard',
            from: '/components/HotCard/index',
          },
        }
      }
      return undefined
    })

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
      } as any,
    )

    const json: Record<string, any> = {
      usingComponents: {
        HotCard: '/components/HotCard/index',
      },
    }

    const injectedEntries = applyAutoImports('/project/src/pages/index/index', json)

    expect(json.usingComponents).toEqual({
      HotCard: '/components/HotCard/index',
    })
    expect(injectedEntries).toEqual(['/components/HotCard/index'])
  })

  it('does not return entries when explicit usingComponents points elsewhere', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'HotCard') {
        return {
          value: {
            name: 'HotCard',
            from: '/components/HotCard/index',
          },
        }
      }
      return undefined
    })

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
      } as any,
    )

    const json: Record<string, any> = {
      usingComponents: {
        HotCard: '/components/ExplicitHotCard/index',
      },
    }

    const injectedEntries = applyAutoImports('/project/src/pages/index/index', json)

    expect(json.usingComponents).toEqual({
      HotCard: '/components/ExplicitHotCard/index',
    })
    expect(injectedEntries).toEqual([])
  })

  it('tracks resolvedId so matched Vue components join the compile flow', () => {
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

  it('tracks local resolvedId for newly registered Vue SFC components', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'HotCard') {
        return {
          value: {
            name: 'HotCard',
            from: '/components/HotCard/index',
            resolvedId: '/project/src/components/HotCard/index.vue',
          },
        }
      }
      return undefined
    })
    const componentEntryMap = new Map<string, string>()

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
      } as any,
      componentEntryMap,
    )

    const json: Record<string, any> = {}
    const injectedEntries = applyAutoImports('/project/src/pages/index/index', json)

    expect(json.usingComponents).toEqual({
      HotCard: '/components/HotCard/index',
    })
    expect(injectedEntries).toEqual(['/components/HotCard/index'])
    expect(componentEntryMap.get('components/HotCard/index')).toBe(
      '/project/src/components/HotCard/index.vue',
    )
  })

  it('tracks local resolvedId when matching usingComponents already exists', () => {
    const resolve = vi.fn((name: string) => {
      if (name === 'HotCard') {
        return {
          value: {
            name: 'HotCard',
            from: '/components/HotCard/index',
            resolvedId: '/project/src/components/HotCard/index.vue',
          },
        }
      }
      return undefined
    })
    const componentEntryMap = new Map<string, string>()

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion: vi.fn(() => 0) } as any,
      {
        getAggregatedAutoImportComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
        getAggregatedComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
      } as any,
      componentEntryMap,
    )

    const json: Record<string, any> = {
      usingComponents: {
        HotCard: '/components/HotCard/index',
      },
    }
    const injectedEntries = applyAutoImports('/project/src/pages/index/index', json)

    expect(json.usingComponents).toEqual({
      HotCard: '/components/HotCard/index',
    })
    expect(injectedEntries).toEqual(['/components/HotCard/index'])
    expect(componentEntryMap.get('components/HotCard/index')).toBe(
      '/project/src/components/HotCard/index.vue',
    )
  })

  it('registers existing local SFC candidates for unresolved template tags before retrying', async () => {
    const tempRoot = path.resolve(import.meta.dirname, '../../../test/__temp__')
    await fs.ensureDir(tempRoot)
    const tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-augmenter-'))
    const srcRoot = path.join(tempDir, 'src')
    const hotCardPath = path.join(srcRoot, 'components/HotCard/index.vue')
    await fs.ensureDir(path.dirname(hotCardPath))
    await fs.writeFile(hotCardPath, '<template><view>hot</view></template>', 'utf8')

    let registered = false
    const resolve = vi.fn((name: string) => {
      if (registered && name === 'HotCard') {
        return {
          value: {
            name: 'HotCard',
            from: '/components/HotCard/index',
            resolvedId: hotCardPath,
          },
        }
      }
      return undefined
    })
    const registerPotentialComponent = vi.fn(async (filePath: string) => {
      expect(filePath).toBe(hotCardPath)
      registered = true
    })
    const componentEntryMap = new Map<string, string>()

    try {
      const applyAutoImports = createAutoImportAugmenter(
        {
          resolve,
          getVersion: vi.fn(() => registered ? 1 : 0),
          registerPotentialComponent,
        } as any,
        {
          getAggregatedAutoImportComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
          getAggregatedComponents: vi.fn(() => ({ HotCard: [{ start: 0, end: 0 }] })),
        } as any,
        componentEntryMap,
        {
          absoluteSrcRoot: srcRoot,
          weappViteConfig: {
            autoImportComponents: {
              globs: ['components/**/*.vue'],
            },
          },
        } as any,
      )

      const json: Record<string, any> = {}
      const injectedEntries = await applyAutoImports(path.join(srcRoot, 'pages/index/index'), json)

      expect(registerPotentialComponent).toHaveBeenCalledTimes(1)
      expect(resolve).toHaveBeenCalledWith('HotCard', path.join(srcRoot, 'pages/index/index'))
      expect(json.usingComponents).toEqual({
        HotCard: '/components/HotCard/index',
      })
      expect(injectedEntries).toEqual(['/components/HotCard/index'])
      expect(componentEntryMap.get('components/HotCard/index')).toBe(hotCardPath)
    }
    finally {
      await fs.remove(tempDir)
      if (await fs.pathExists(tempRoot)) {
        const remaining = await fs.readdir(tempRoot)
        if (remaining.length === 0) {
          await fs.remove(tempRoot)
        }
      }
    }
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
