import type { OutputBundle } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createLogicalEntryId } from '../../moduleGraph/protocol'
import { captureNativeEntryAssetOwners, clearNativeEntryAssetOwners, collectNativeEntryAssetOwners, readNativeEntryAssetOwners } from './nativeEntryAssetOwners'

function bundle(entries: Array<[string, 'app' | 'page' | 'component' | 'layout']>, imported = '/project/src/components/hidden.vue'): OutputBundle {
  return {
    'entry.js': {
      type: 'chunk',
      facadeModuleId: entries[0] && createLogicalEntryId(...entries[0]),
      moduleIds: [...entries.slice(1).map(entry => createLogicalEntryId(...entry)), imported],
    },
    'ordinary-import.js': { type: 'chunk', isEntry: false, facadeModuleId: imported, moduleIds: [imported] },
    'ignored.json': { type: 'asset', source: '{}' },
  } as OutputBundle
}

describe('native entry asset ownership', () => {
  const owner = '/project/src/pages/index.vue'
  const shared = '/project/src/components/shared.vue'
  const layout = '/project/src/layouts/default.vue'

  it('recognizes logical facades and merged registration modules while excluding ordinary physical imports', () => {
    const owners = collectNativeEntryAssetOwners(bundle([
      [owner, 'page'],
      [shared, 'component'],
      [shared, 'component'],
      [layout, 'layout'],
      ['/project/src/app.vue', 'app'],
    ]))
    expect([...owners]).toEqual([owner, shared, layout, '/project/src/app.vue'])
    expect(owners.has('/project/src/components/hidden.vue')).toBe(false)
  })

  it.each([false, true])('retains the current graph before metadata-only chunk removal (bundledDev=%s)', (bundledDev) => {
    const ctx = {}
    const environment = {}
    const output = { dir: 'dist', format: 'cjs' }
    const current = bundle([[owner, 'page'], [shared, 'component']])
    captureNativeEntryAssetOwners(ctx, environment, output, current)
    if (!bundledDev) {
      delete current['entry.js']
      delete current['ordinary-import.js']
    }
    expect([...readNativeEntryAssetOwners(ctx, environment, output)]).toEqual([owner, shared])
  })

  it('replaces output ownership with an empty graph and clears it before a new generation or teardown', () => {
    const ctx = {}
    const environment = {}
    const output = { dir: 'dist' }
    captureNativeEntryAssetOwners(ctx, environment, output, bundle([[owner, 'page']]))
    captureNativeEntryAssetOwners(ctx, environment, output, {})
    expect(readNativeEntryAssetOwners(ctx, environment, output).size).toBe(0)
    captureNativeEntryAssetOwners(ctx, environment, output, bundle([[owner, 'page']]))
    clearNativeEntryAssetOwners(ctx, environment)
    expect(readNativeEntryAssetOwners(ctx, environment, output).size).toBe(0)
    clearNativeEntryAssetOwners(ctx, environment)
    captureNativeEntryAssetOwners(ctx, environment, output, bundle([[shared, 'component']]))
    expect([...readNativeEntryAssetOwners(ctx, environment, output)]).toEqual([shared])
  })

  it('derives scriptless layouts only from current logical parents and matching emitted script assets', () => {
    let dependencies = [{ kind: 'layout' as const, sourceId: layout }]
    const ctx = {
      moduleGraphService: { getEntryDependencies: (id: string) => id === owner ? dependencies : [] },
      configService: { relativeOutputPath: (id: string) => id.replace('/project/src/', '') },
    }
    const output = { dir: 'dist' }
    const current = {
      ...bundle([[owner, 'page']]),
      'layouts/default.js': { type: 'asset', source: 'Component({})' },
    } as OutputBundle
    captureNativeEntryAssetOwners(ctx, undefined, output, current)
    expect([...readNativeEntryAssetOwners(ctx, undefined, output)]).toEqual([owner, layout])
    captureNativeEntryAssetOwners(ctx, undefined, { dir: 'other' }, bundle([[owner, 'page']]))
    expect([...readNativeEntryAssetOwners(ctx, undefined, { dir: 'other' })]).toEqual([owner])
    dependencies = []
    captureNativeEntryAssetOwners(ctx, undefined, output, current)
    expect([...readNativeEntryAssetOwners(ctx, undefined, output)]).toEqual([owner])
    dependencies = [{ kind: 'layout', sourceId: layout }]
    captureNativeEntryAssetOwners(ctx, undefined, output, {
      'layouts/default.js': current['layouts/default.js']!,
    })
    expect(readNativeEntryAssetOwners(ctx, undefined, output).size).toBe(0)
    captureNativeEntryAssetOwners(ctx, undefined, output, current)
    clearNativeEntryAssetOwners(ctx)
    expect(readNativeEntryAssetOwners(ctx, undefined, output).size).toBe(0)
  })

  it('isolates compiler contexts, environments and distinct outputs without authorizing an uncaptured scope', () => {
    const ctx = {}
    const environment = {}
    const otherEnvironment = {}
    captureNativeEntryAssetOwners(ctx, environment, { dir: 'dist' }, bundle([[owner, 'page']]))
    captureNativeEntryAssetOwners(ctx, environment, { dir: 'other' }, bundle([[shared, 'component']]))
    captureNativeEntryAssetOwners(ctx, otherEnvironment, { dir: 'dist' }, bundle([[layout, 'layout']]))
    expect([...readNativeEntryAssetOwners(ctx, environment, { dir: 'dist' })]).toEqual([owner])
    expect([...readNativeEntryAssetOwners(ctx, environment, { dir: 'other' })]).toEqual([shared])
    expect([...readNativeEntryAssetOwners(ctx, otherEnvironment, { dir: 'dist' })]).toEqual([layout])
    expect(readNativeEntryAssetOwners({}, environment, { dir: 'dist' }).size).toBe(0)
    expect(readNativeEntryAssetOwners(ctx, {}, { dir: 'dist' }).size).toBe(0)
    expect(readNativeEntryAssetOwners(ctx, environment, { dir: 'uncaptured' }).size).toBe(0)
    clearNativeEntryAssetOwners(ctx, environment)
    expect([...readNativeEntryAssetOwners(ctx, otherEnvironment, { dir: 'dist' })]).toEqual([layout])
  })

  it('releases the output authorization before collecting a failed replacement graph', () => {
    const ctx = {}
    const output = { dir: 'dist' }
    captureNativeEntryAssetOwners(ctx, undefined, output, bundle([[owner, 'page']]))
    const failure = new Error('output graph unavailable')
    const invalid = {
      get entry() {
        throw failure
      },
    } as unknown as OutputBundle
    expect(() => captureNativeEntryAssetOwners(ctx, undefined, output, invalid)).toThrow(failure)
    expect(readNativeEntryAssetOwners(ctx, undefined, output).size).toBe(0)
  })
})
