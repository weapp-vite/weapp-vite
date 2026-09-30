import type { JsonMergeContext } from 'wevu/compiler'
import { expect, it, vi } from 'vitest'
import { emitSharedVueEntryJsonAsset } from './bundle/shared/assets'
import { emitSfcJsonAsset } from './emitAssets'

it('carries compiler metadata into emit and merge-existing callbacks', () => {
  const contexts: JsonMergeContext[] = []
  const meta = { routeConfig: { name: 'profile', meta: { title: '个人中心' } }, pageMeta: { layout: false } }
  const bundle = { 'pages/profile/index.json': { type: 'asset', source: '{"existing":true}' } }
  emitSfcJsonAsset({ emitFile: vi.fn() }, bundle, 'pages/profile/index', { config: '{"navigationStyle":"custom"}', meta }, {
    kind: 'page',
    defaultConfig: { component: true },
    mergeExistingAsset: true,
    mergeStrategy(target, source, context) {
      contexts.push(context)
      return { ...target, ...source, navigationBarTitleText: context.routeConfig?.meta?.title }
    },
  })
  expect(contexts.map(context => context.stage)).toEqual(['emit', 'merge-existing'])
  for (const context of contexts) {
    expect(context).toMatchObject({ filename: 'pages/profile/index.json', kind: 'page', ...meta })
  }
  expect(JSON.parse(bundle['pages/profile/index.json'].source)).toMatchObject({ existing: true, component: true, navigationBarTitleText: '个人中心' })
})

it('preserves page metadata through platform normalization and bundle emission', () => {
  const contexts: JsonMergeContext[] = []
  const meta = { routeConfig: { name: 'profile' }, pageMeta: { layout: false } }
  const emitFile = vi.fn()
  emitSharedVueEntryJsonAsset({
    bundle: {},
    pluginCtx: { emitFile },
    relativeBase: 'pages/profile/index',
    config: '{"navigationStyle":"custom"}',
    meta,
    outputExtensions: { json: 'json', wxml: 'wxml', wxss: 'wxss', js: 'js', wxs: 'wxs' },
    platformAssetOptions: { platform: 'weapp', templateExtension: 'wxml' },
    jsonOptions: {
      defaultConfig: {},
      kind: 'page',
      extension: 'json',
      mergeStrategy(target, source, context) {
        contexts.push(context)
        return { ...target, ...source, navigationBarTitleText: context.routeConfig?.name }
      },
    },
  })
  expect(contexts).toContainEqual(expect.objectContaining({ stage: 'emit', ...meta }))
  expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({ source: expect.stringContaining('profile') }))
})
