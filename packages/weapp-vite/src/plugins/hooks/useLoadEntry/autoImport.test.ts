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
        getAggregatedComponents: vi.fn(() => ({ Navbar: [{ start: 0, end: 0 }] })),
      } as any,
    )

    const json: Record<string, any> = {}
    applyAutoImports('/project/src/pages/index/index', json)

    expect(resolve).toHaveBeenCalledWith('Navbar', '/project/src/pages/index/index')
    expect(json.usingComponents).toEqual({
      Navbar: '/components/Navbar/index',
    })
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
        getAggregatedComponents: vi.fn(() => ({ Navbar: [{ start: 0, end: 0 }] })),
      } as any,
    )

    const json: Record<string, any> = {}
    applyAutoImports('/project/src/pages/index/index', json)

    expect(resolve).toHaveBeenCalledWith('Navbar', '/project/src/pages/index/index')
    expect(json.usingComponents).toBeUndefined()
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
    const getAggregatedComponents = vi.fn(() => hit)

    const applyAutoImports = createAutoImportAugmenter(
      { resolve, getVersion } as any,
      { getAggregatedComponents } as any,
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
})
