import type { StatefulHmrOutputFile } from './outputWriter'
import { HmrAssetStore } from '@weapp-vite/hmr'
import { describe, expect, it } from 'vitest'
import { createStatefulHmrGlobalStyleAssets } from './globalStyles'
import { StatefulHmrOutputCapabilities } from './outputCapabilities'

function style(source: string | Uint8Array, fileName = 'app.wxss'): Extract<StatefulHmrOutputFile, { type: 'asset' }> {
  return { type: 'asset', fileName, source }
}

describe('stateful compiled output capabilities', () => {
  it('allows initial styles and establishes admission only after the first successful full publication', () => {
    const capabilities = new StatefulHmrOutputCapabilities('wxss')
    expect(capabilities.fallback([style('red')])).toBeUndefined()
    capabilities.published([style('red')], [], false)
    expect(capabilities.fallback([style('blue')])).toBeUndefined()
    capabilities.published([style('blue')], [], true)
    expect(capabilities.fallback([style('red')])).toMatchObject({ code: 'stylesheet-output', files: ['app.wxss'] })
  })

  it('compares actual compiled bytes while retaining styles omitted from partial native output', () => {
    const capabilities = new StatefulHmrOutputCapabilities('wxss')
    capabilities.published([style('red'), style('local', 'pages/home/index.wxss')], [], true)
    const script = { type: 'chunk' as const, fileName: 'pages/home/index.js', code: 'updated()', modules: {} }
    expect(capabilities.fallback([script, style(Uint8Array.from([114, 101, 100]))])).toBeUndefined()
    capabilities.published([script], [], false)
    expect(capabilities.fallback([style('local', 'pages/home/index.wxss')])).toBeUndefined()
    expect(capabilities.fallback([style('changed', 'pages/home/index.wxss')])).toMatchObject({ code: 'stylesheet-output' })
  })

  it('rejects new and explicitly removed compiled styles without treating omissions as removals', () => {
    const capabilities = new StatefulHmrOutputCapabilities('wxss')
    capabilities.published([style('red')], [], true)
    expect(capabilities.fallback([])).toBeUndefined()
    expect(capabilities.fallback([style('new', 'pages/new/index.wxss')])).toMatchObject({ files: ['pages/new/index.wxss'] })
    expect(capabilities.fallback([], ['app.wxss'])).toMatchObject({ files: ['app.wxss'] })
    expect(capabilities.fallback([], ['never-published.wxss'])).toBeUndefined()
  })

  it('keeps the published stylesheet baseline when a separate snapshot store requires forced replay', () => {
    const capabilities = new StatefulHmrOutputCapabilities('wxss')
    const assets = [style('red')]
    capabilities.published(assets, [], true)
    const snapshots = new HmrAssetStore<Extract<StatefulHmrOutputFile, { type: 'asset' }>>()
    snapshots.adopt(assets)
    snapshots.invalidate()
    const replay = snapshots.diff(assets)
    expect(replay.changed).toHaveLength(1)
    expect(capabilities.fallback(replay.changed, replay.removed)).toBeUndefined()
  })

  it('copies successful binary output and never adopts inspected or rejected output', () => {
    const capabilities = new StatefulHmrOutputCapabilities('wxss')
    const source = Uint8Array.from([114, 101, 100])
    capabilities.published([style(source)], [], true)
    source.fill(0)
    expect(capabilities.fallback([style('red')])).toBeUndefined()
    expect(capabilities.fallback([style('blue')])).toMatchObject({ code: 'stylesheet-output' })
    expect(capabilities.fallback([style('red')])).toBeUndefined()
  })

  it('does not infer stylesheet changes from script, Vue, JSON provider or asset source names', () => {
    const capabilities = new StatefulHmrOutputCapabilities('wxss')
    capabilities.published([style('red')], [], true)
    expect(capabilities.fallback([
      { type: 'asset', fileName: 'pages/home/index.wxml', source: '<view>changed</view>' },
      { type: 'asset', fileName: 'tokens.json', source: '{}' },
      { type: 'asset', fileName: 'icon.svg', source: '<svg />' },
      { type: 'asset', fileName: 'app.wxss.map', source: '{}' },
    ])).toBeUndefined()
  })

  it('preserves duplicate output ownership errors instead of converting them to a capability reason', () => {
    const capabilities = new StatefulHmrOutputCapabilities('wxss')
    capabilities.published([style('red')], [], true)
    expect(() => capabilities.fallback([style('blue'), style('green')])).toThrow('multiple owners')
  })

  it('keeps regenerated page refresh markers stable when compiled stylesheet bytes do not change', () => {
    const capabilities = new StatefulHmrOutputCapabilities('wxss')
    const output = () => createStatefulHmrGlobalStyleAssets([style('.probe { color: red; }')], 'wxss', {
      componentPageGlobalStyleRoutes: ['pages/home/index'],
      refreshPageStyles: true,
    })
    const initial = output()
    capabilities.published(initial, [], true)
    expect(output()).toEqual(initial)
    expect(capabilities.fallback(output())).toBeUndefined()
    expect(capabilities.fallback(createStatefulHmrGlobalStyleAssets(initial, 'wxss', {
      componentPageGlobalStyleRoutes: ['pages/home/index'],
      refreshPageStyles: true,
    }))).toBeUndefined()
  })
})
