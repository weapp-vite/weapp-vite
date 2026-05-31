import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emitClassStyleWxsAssetIfMissing,
  emitSfcJsonAsset,
  emitSfcTemplateIfMissing,
  resetEmittedAssetSourceCacheForTest,
} from './emitAssets'

describe('emitAssets', () => {
  beforeEach(() => {
    resetEmittedAssetSourceCacheForTest()
  })

  function createEmitter() {
    const emitFile = vi.fn()
    return {
      ctx: { emitFile },
      emitFile,
    }
  }

  it('deduplicates emitted sources only within the current bundle', () => {
    const first = createEmitter()
    const firstBundle: Record<string, any> = {}

    emitSfcTemplateIfMissing(first.ctx, firstBundle, '__weapp_vite_slot_wrapper', '<slot></slot>')
    emitSfcTemplateIfMissing(first.ctx, firstBundle, '__weapp_vite_slot_wrapper', '<slot></slot>')
    emitSfcJsonAsset(first.ctx, firstBundle, '__weapp_vite_slot_wrapper', {
      config: JSON.stringify({ component: true }),
    }, {
      kind: 'component',
    })
    emitSfcJsonAsset(first.ctx, firstBundle, '__weapp_vite_slot_wrapper', {
      config: JSON.stringify({ component: true }),
    }, {
      kind: 'component',
    })
    emitClassStyleWxsAssetIfMissing(first.ctx, firstBundle, '__weapp_vite_class_style.wxs', 'module.exports = {}')
    emitClassStyleWxsAssetIfMissing(first.ctx, firstBundle, '__weapp_vite_class_style.wxs', 'module.exports = {}')

    expect(first.emitFile.mock.calls.map(call => call[0].fileName)).toEqual([
      '__weapp_vite_slot_wrapper.wxml',
      '__weapp_vite_slot_wrapper.json',
      '__weapp_vite_class_style.wxs',
    ])

    const second = createEmitter()
    const secondBundle: Record<string, any> = {}

    emitSfcTemplateIfMissing(second.ctx, secondBundle, '__weapp_vite_slot_wrapper', '<slot></slot>')
    emitSfcJsonAsset(second.ctx, secondBundle, '__weapp_vite_slot_wrapper', {
      config: JSON.stringify({ component: true }),
    }, {
      kind: 'component',
    })
    emitClassStyleWxsAssetIfMissing(second.ctx, secondBundle, '__weapp_vite_class_style.wxs', 'module.exports = {}')

    expect(second.emitFile.mock.calls.map(call => call[0].fileName)).toEqual([
      '__weapp_vite_slot_wrapper.wxml',
      '__weapp_vite_slot_wrapper.json',
      '__weapp_vite_class_style.wxs',
    ])
  })
})
