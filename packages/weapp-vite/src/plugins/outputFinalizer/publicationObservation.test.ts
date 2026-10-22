import type { EmittedAsset, OutputBundle } from 'rolldown'
import { Buffer } from 'node:buffer'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createNativePublicationObservation } from './publicationObservation'

const app = { 'app.js': { type: 'chunk', fileName: 'app.js', code: 'App({})' } } as OutputBundle

describe('committed native publication observation', () => {
  it('requires a prior successful native byte write before acknowledging an empty publication', async () => {
    const cache = new Map([['app.js', 'App({})']])
    const observation = createNativePublicationObservation(path.resolve('native-observation'), cache)
    const pending = observation.whenCommitted(1)
    expect(observation.readCommitted(1)).toBeUndefined()
    observation.commit(1, {}, [])
    expect(await pending).toBeUndefined()
    expect(observation.readCommitted(1)).toBeUndefined()
    observation.invalidate()
    observation.commit(2, app, [])
    expect(observation.readCommitted(2)?.outputs.get('app.js')).toBe('App({})')
    observation.invalidate()
    const noop = observation.whenCommitted(3)
    observation.commit(3, {}, [])
    expect((await noop)?.outputs.get('app.js')).toBe('App({})')
  })

  it('returns complete binary and supplementary bytes without exposing mutable compiler caches', async () => {
    const root = path.resolve('native-observation')
    const bytes = Uint8Array.from([0, 255, 64])
    const publicBytes = Uint8Array.from([128, 1])
    const cache = new Map([['app.js', 'App({})'], ['icon.bin', Buffer.from(bytes).toString('base64')]])
    const observation = createNativePublicationObservation(root, cache)
    const pending = observation.whenCommitted(5)
    observation.commit(5, { ...app, 'icon.bin': { type: 'asset', fileName: 'icon.bin', source: bytes } } as OutputBundle, [
      { type: 'asset', fileName: 'public.bin', source: publicBytes },
      { type: 'asset', fileName: 'pkg/page.wxml', source: '<view>independent</view>' },
    ])
    const snapshot = (await pending)!
    expect(snapshot.root).toBe(root)
    expect(snapshot.epoch).toBe(5)
    expect([...snapshot.outputs.keys()].sort()).toEqual(['app.js', 'icon.bin', 'pkg/page.wxml', 'public.bin'])
    expect([...snapshot.outputs.get('icon.bin') as Uint8Array]).toEqual([...bytes])
    expect([...snapshot.outputs.get('public.bin') as Uint8Array]).toEqual([...publicBytes])
    expect('set' in snapshot.outputs).toBe(false)
    const observedIcon = snapshot.outputs.get('icon.bin') as Uint8Array
    const observedPublic = snapshot.outputs.get('public.bin') as Uint8Array
    observedIcon[0] = 17
    observedPublic[0] = 18
    expect(cache.get('icon.bin')).toBe(Buffer.from(bytes).toString('base64'))
    expect([...observation.readCommitted(5)!.outputs.get('icon.bin') as Uint8Array]).toEqual([...bytes])
    expect([...observation.readCommitted(5)!.outputs.get('public.bin') as Uint8Array]).toEqual([...publicBytes])
    expect(publicBytes[0]).toBe(128)
    cache.set('app.js', 'new compiler generation')
    expect(snapshot.outputs.get('app.js')).toBe('App({})')
  })

  it('keeps all current public and independent bytes across partial commits and retires removed sources', async () => {
    const cache = new Map([['app.js', 'App({})'], ['pages/index.wxml', '<view>BASE</view>']])
    const observation = createNativePublicationObservation(path.resolve('native-observation'), cache)
    const assets: EmittedAsset[] = [
      { type: 'asset', fileName: 'public.txt', source: 'public' },
      { type: 'asset', fileName: 'pkg/page.wxml', source: '<view>independent</view>' },
    ]
    observation.commit(1, app, assets)
    observation.invalidate()
    cache.set('pages/index.wxml', '<view>FINAL</view>')
    observation.commit(2, { 'pages/index.wxml': { type: 'asset', fileName: 'pages/index.wxml', source: '<view>FINAL</view>' } } as OutputBundle, assets)
    observation.invalidate()
    observation.commit(3, {}, assets)
    expect(Object.fromEntries(observation.readCommitted(3)!.outputs)).toEqual({
      'app.js': 'App({})',
      'pages/index.wxml': '<view>FINAL</view>',
      'public.txt': 'public',
      'pkg/page.wxml': '<view>independent</view>',
    })
    observation.invalidate()
    cache.delete('pages/index.wxml')
    observation.commit(4, {}, [])
    expect(Object.fromEntries(observation.readCommitted(4)!.outputs)).toEqual({ 'app.js': 'App({})' })
  })

  it('settles abandoned requests without reusing an earlier epoch', async () => {
    const observation = createNativePublicationObservation(path.resolve('native-observation'), new Map([['app.js', 'App({})']]))
    observation.commit(1, app, [])
    observation.invalidate()
    const abandoned = observation.whenCommitted(2)
    observation.invalidate()
    expect(await abandoned).toBeUndefined()
    expect(observation.readCommitted(1)).toBeUndefined()
    expect(observation.readCommitted(2)).toBeUndefined()
    observation.commit(3, {}, [])
    expect(observation.readCommitted(3)?.epoch).toBe(3)
    expect(observation.readCommitted(2)).toBeUndefined()
  })

  it('does not reuse proof across reset or between output roots', async () => {
    const first = createNativePublicationObservation(path.resolve('native-observation/first'), new Map([['app.js', 'first']]))
    const second = createNativePublicationObservation(path.resolve('native-observation/second'), new Map([['app.js', 'second']]))
    first.commit(1, app, [])
    second.commit(1, {}, [])
    expect(first.readCommitted(1)?.outputs.get('app.js')).toBe('first')
    expect(second.readCommitted(1)).toBeUndefined()
    first.reset()
    const pending = first.whenCommitted(2)
    first.commit(2, {}, [])
    expect(await pending).toBeUndefined()
    expect(first.readCommitted(2)).toBeUndefined()
  })
})
