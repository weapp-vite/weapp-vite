import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emitClassStyleWxsAssetIfMissing,
  emitSfcJsonAsset,
  emitSfcScriptAssetReplacingBundleEntry,
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

  it('replaces an existing script chunk code without emitting a duplicate file', () => {
    const emitter = createEmitter()
    const existingChunk = {
      type: 'chunk',
      fileName: 'app.js',
      code: 'App({ old: true })',
      imports: ['common.js'],
    }
    const bundle: Record<string, any> = {
      'app.js': existingChunk,
    }

    emitSfcScriptAssetReplacingBundleEntry(
      emitter.ctx,
      bundle,
      'app',
      'App({ fresh: true })',
      'js',
    )

    expect(bundle['app.js']).toBe(existingChunk)
    expect(bundle['app.js']).toEqual({
      type: 'chunk',
      fileName: 'app.js',
      code: 'App({ fresh: true })',
      imports: ['common.js'],
    })
    expect(emitter.emitFile).not.toHaveBeenCalled()
  })

  it('replaces an existing script asset source without emitting a duplicate file', () => {
    const emitter = createEmitter()
    const existingAsset = {
      type: 'asset',
      fileName: 'app.js',
      source: 'App({ old: true })',
    }
    const bundle: Record<string, any> = {
      'app.js': existingAsset,
    }

    emitSfcScriptAssetReplacingBundleEntry(
      emitter.ctx,
      bundle,
      'app',
      'App({ fresh: true })',
      'js',
    )

    expect(bundle['app.js']).toBe(existingAsset)
    expect(bundle['app.js']).toEqual({
      type: 'asset',
      fileName: 'app.js',
      source: 'App({ fresh: true })',
    })
    expect(emitter.emitFile).not.toHaveBeenCalled()
  })

  it('emits script assets when the bundle has no existing script output', () => {
    const emitter = createEmitter()
    const bundle: Record<string, any> = {}

    emitSfcScriptAssetReplacingBundleEntry(
      emitter.ctx,
      bundle,
      'app',
      'App({ fresh: true })',
      'js',
    )

    expect(emitter.emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'app.js',
      source: 'App({ fresh: true })',
    })
  })
})
