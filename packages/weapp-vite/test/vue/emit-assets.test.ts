import { describe, expect, it, vi } from 'vitest'
import { emitSfcJsonAsset, emitSfcStyleIfMissing, emitSfcTemplateIfMissing } from '../../src/plugins/vue/transform/vitePlugin/emitAssets'

describe('emitSfcTemplateIfMissing', () => {
  it('emits when asset missing', () => {
    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    emitSfcTemplateIfMissing({ emitFile }, bundle, 'components/hello', '<view />')

    expect(emitFile).toHaveBeenCalledTimes(1)
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'components/hello.wxml',
      source: '<view />',
    })
  })

  it('updates existing asset when source differs', () => {
    const emitFile = vi.fn()
    const bundle: Record<string, any> = {
      'components/hello.wxml': { type: 'asset', source: '<view>old</view>' },
    }

    emitSfcTemplateIfMissing({ emitFile }, bundle, 'components/hello', '<view>new</view>')

    expect(emitFile).not.toHaveBeenCalled()
    expect(bundle['components/hello.wxml'].source).toBe('<view>new</view>')
  })

  it('keeps existing asset when source matches', () => {
    const emitFile = vi.fn()
    const bundle: Record<string, any> = {
      'components/hello.wxml': { type: 'asset', source: '<view>same</view>' },
    }

    emitSfcTemplateIfMissing({ emitFile }, bundle, 'components/hello', '<view>same</view>')

    expect(emitFile).not.toHaveBeenCalled()
    expect(bundle['components/hello.wxml'].source).toBe('<view>same</view>')
  })
})

describe('emitSfcStyleIfMissing', () => {
  it('updates existing asset when source differs', () => {
    const emitFile = vi.fn()
    const bundle: Record<string, any> = {
      'components/hello.wxss': { type: 'asset', source: '.old{}' },
    }

    emitSfcStyleIfMissing({ emitFile }, bundle, 'components/hello', '.new{}')

    expect(emitFile).not.toHaveBeenCalled()
    expect(bundle['components/hello.wxss'].source).toBe('.new{}')
  })
})

describe('emitSfcJsonAsset', () => {
  it('overwrites existing asset when mergeExistingAsset is false', () => {
    const emitFile = vi.fn()
    const bundle: Record<string, any> = {
      'components/hello.json': {
        type: 'asset',
        source: JSON.stringify({
          component: true,
          styleIsolation: 'apply-shared',
          usingComponents: { a: '/a' },
        }),
      },
    }

    emitSfcJsonAsset(
      { emitFile },
      bundle,
      'components/hello',
      {
        config: JSON.stringify({
          usingComponents: { a: '/a' },
        }),
      },
      {
        defaultConfig: { component: true },
        mergeExistingAsset: false,
      },
    )

    expect(emitFile).not.toHaveBeenCalled()
    expect(JSON.parse(bundle['components/hello.json'].source)).toEqual({
      component: true,
      usingComponents: { a: '/a' },
    })
  })
})
