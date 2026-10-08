import { EventEmitter } from 'node:events'
import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSnapshotTemplateFixture } from '../../../test/snapshotTemplates/fixture'

const harness = vi.hoisted(() => ({
  build: vi.fn(),
  change: undefined as ((change: { event: 'update' | 'create', file: string }) => void) | undefined,
  sidecars: [] as EventEmitter[],
}))
vi.mock('vite', async importOriginal => ({ ...await importOriginal<typeof import('vite')>(), build: harness.build }))
vi.mock('../../moduleGraph/devProvider', () => ({
  createDevModuleGraphProvider: vi.fn(async (_ctx, _config, onChange) => {
    harness.change = onChange
    return { close: vi.fn(async () => {}) }
  }),
}))
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => {
      let closed = false
      const watcher = Object.assign(new EventEmitter(), {
        add: vi.fn(),
        unwatch: vi.fn(),
        close: async () => {
          closed = true
        },
      })
      harness.sidecars.push(watcher)
      setImmediate(() => {
        if (!closed) {
          watcher.emit('ready')
        }
      })
      return watcher
    }),
  },
}))

const cleanups: Array<() => Promise<void>> = []
beforeEach(() => {
  harness.build.mockReset()
  harness.change = undefined
  harness.sidecars = []
  vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
  vi.unstubAllEnvs()
})

const createFixture = () => createSnapshotTemplateFixture(harness, cleanups)

describe('classic template snapshot source freshness', () => {
  it('refreshes shared template source through the real snapshot scheduler without touching its owner', async () => {
    const fixture = await createFixture()
    expect(fixture.bundles[0]?.['shared/card.wxml']).toMatchObject({ source: fixture.files['shared/card.wxml'] })
    await fixture.save('shared/card.wxml', '<template name="card"><view>card updated</view></template>')
    fixture.update('shared/card.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(fixture.ctx.wxmlService.tokenMap.get(fixture.absolute('shared/card.wxml'))?.code).toContain('card updated')
    expect(bundle['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card updated') })
    expect(bundle['components/layout/index.wxml']).toBeUndefined()
  })

  it('refreshes every shared import/include in one batch, including nested dependencies', async () => {
    const fixture = await createFixture()
    await fixture.save('shared/card.wxml', '<template name="card"><view>card updated</view></template>')
    await fixture.save('shared/partial.wxml', '<view>partial updated</view>')
    fixture.update('shared/card.wxml', 'shared/partial.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(bundle['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card updated') })
    expect(bundle['shared/partial.wxml']).toMatchObject({ source: '<view>partial updated</view>' })
  })

  it('tracks an isolated nested include as a real owner dependency', async () => {
    const fixture = await createFixture()
    expect(fixture.ctx.moduleGraphService.hasModule(fixture.absolute('shared/partial.wxml'))).toBe(true)
    await fixture.save('shared/partial.wxml', '<view>partial updated</view>')
    fixture.update('shared/partial.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(bundle['shared/partial.wxml']).toMatchObject({ source: '<view>partial updated</view>' })
  })

  it('keeps changes arriving during a build for the next snapshot', async () => {
    const fixture = await createFixture()
    fixture.controls.beforeRender = async () => {
      fixture.controls.beforeRender = undefined
      await fixture.save('shared/partial.wxml', '<view>partial queued</view>')
      fixture.update('shared/partial.wxml')
      expect(fixture.ctx.moduleGraphService.getPendingChanges().map(change => change.file)).toEqual([
        fixture.absolute('shared/card.wxml'),
      ])
    }
    await fixture.save('shared/card.wxml', '<template name="card"><view>card first batch</view></template>')
    fixture.update('shared/card.wxml')
    await vi.waitFor(() => expect(fixture.bundles).toHaveLength(3))
    expect(fixture.bundles[1]?.['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card first batch') })
    expect(fixture.bundles[1]?.['shared/partial.wxml']).toBeUndefined()
    expect(fixture.bundles[2]?.['shared/partial.wxml']).toMatchObject({ source: '<view>partial queued</view>' })
  })

  it('replays a failed batch with the next request even after output caches were populated', async () => {
    const fixture = await createFixture()
    fixture.controls.failAfterRender = true
    await fixture.save('shared/card.wxml', '<template name="card"><view>card retry</view></template>')
    fixture.update('shared/card.wxml')
    const failure = await fixture.nextFailure(0)
    expect(String(failure)).toContain('simulated write failure')
    expect(fixture.controls.failAfterRender).toBe(false)
    expect(fixture.bundles).toHaveLength(1)
    expect(fixture.writes).toHaveLength(1)
    expect(fixture.ctx.runtimeState.build.output.emittedSource.get('shared/card.wxml')).toContain('card retry')
    expect(await fixture.readOutput('shared/card.wxml')).toBe(fixture.files['shared/card.wxml'])
    expect(await fixture.readOutput('pages/unrelated/index.wxml')).toBe(fixture.files['pages/unrelated/index.wxml'])
    await fixture.save('shared/partial.wxml', '<view>partial next request</view>')
    fixture.update('shared/partial.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(bundle['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card retry') })
    expect(bundle['shared/partial.wxml']).toMatchObject({ source: '<view>partial next request</view>' })
    expect(await fixture.readOutput('shared/card.wxml')).toContain('card retry')
    expect(await fixture.readOutput('shared/partial.wxml')).toBe('<view>partial next request</view>')
    expect(await fixture.readOutput('pages/unrelated/index.wxml')).toBe(fixture.files['pages/unrelated/index.wxml'])
    expect(fixture.failures).toHaveLength(1)
    expect(fixture.failures[0]).toBe(failure)
  })

  it('deduplicates cyclic import/include dependencies after a shared topology update', async () => {
    const fixture = await createFixture()
    await fixture.save('shared/card.wxml', '<import src="./wrapper.wxml"/><template name="card"><view>card updated</view></template>')
    await fixture.save('shared/partial.wxml', '<import src="./card.wxml"/><view>partial updated</view>')
    fixture.update('shared/card.wxml', 'shared/partial.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(bundle['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card updated') })
    const templates = fixture.ctx.moduleGraphService.getEntryDependencies(fixture.absolute('components/layout/index.ts')).filter(item => item.kind === 'template')
    expect(templates.map(item => path.relative(fixture.absolute(''), item.sourceId)).sort()).toEqual([
      'components/layout/index.wxml',
      'shared/card.wxml',
      'shared/partial.wxml',
      'shared/wrapper.wxml',
    ])
  })

  it.each(['initial', 'restored'])('does not retain deleted shared tokens and restores %s content through the same scheduler', async (content) => {
    const fixture = await createFixture()
    const card = fixture.absolute('shared/card.wxml')
    expect(await fixture.readOutput('shared/card.wxml')).toBe(fixture.files['shared/card.wxml'])
    expect(await fixture.readOutput('pages/unrelated/index.wxml')).toBe(fixture.files['pages/unrelated/index.wxml'])
    await fixture.save('components/layout/index.wxml', '<include src="../../shared/wrapper.wxml"/>')
    await rm(card)
    fixture.update('components/layout/index.wxml')
    fixture.sidecar.emit('all', 'unlink', card)
    const removed = await fixture.nextBundle(1)
    expect(fixture.ctx.wxmlService.tokenMap.has(card)).toBe(false)
    expect(removed['shared/card.wxml']).toBeUndefined()
    expect(removed['pages/unrelated/index.wxml']).toMatchObject({ source: '<view>unrelated page</view>' })
    await expect(fixture.readOutput('shared/card.wxml')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await fixture.readOutput('pages/unrelated/index.wxml')).toBe(fixture.files['pages/unrelated/index.wxml'])
    expect(fixture.ctx.moduleGraphService.hasModule(card)).toBe(false)
    await fixture.save('shared/card.wxml', `<template name="card"><view>card ${content}</view></template>`)
    await fixture.save('components/layout/index.wxml', fixture.files['components/layout/index.wxml'])
    // card 已脱离依赖图，provider 忽略其 create；owner 更新会增量重新发现模板依赖。
    harness.change!({ event: 'create', file: card })
    fixture.update('components/layout/index.wxml')
    const restored = await fixture.nextBundle(2)
    expect(restored['shared/card.wxml']).toMatchObject({ source: expect.stringContaining(`card ${content}`) })
    expect(restored['components/layout/index.wxml']).toMatchObject({ source: fixture.files['components/layout/index.wxml'] })
    expect(Object.keys(restored).filter(file => file.endsWith('.wxml')).sort()).toEqual([
      'components/layout/index.wxml',
      'shared/card.wxml',
    ])
    expect(restored['pages/unrelated/index.wxml']).toBeUndefined()
    expect(await fixture.readOutput('shared/card.wxml')).toBe(`<template name="card"><view>card ${content}</view></template>`)
    expect(await fixture.readOutput('components/layout/index.wxml')).toBe(fixture.files['components/layout/index.wxml'])
    expect(await fixture.readOutput('pages/unrelated/index.wxml')).toBe(fixture.files['pages/unrelated/index.wxml'])
    expect(fixture.failures).toHaveLength(0)
  })

  it.each(['initial', 'restored'])('preserves published files when a referenced template is missing and recovers with %s content', async (content) => {
    const fixture = await createFixture()
    const card = fixture.absolute('shared/card.wxml')
    const owner = await fixture.readOutput('components/layout/index.wxml')
    await rm(card)
    fixture.sidecar.emit('all', 'unlink', card)
    const failure = await fixture.nextFailure(0)
    expect(String(failure)).toContain('ENOENT')
    expect(String(failure)).toMatch(/shared[/\\]card\.wxml/)
    expect(fixture.bundles).toHaveLength(1)
    expect(fixture.writes).toHaveLength(1)
    expect(await fixture.readOutput('shared/card.wxml')).toBe(fixture.files['shared/card.wxml'])
    expect(await fixture.readOutput('components/layout/index.wxml')).toBe(owner)
    expect(await fixture.readOutput('pages/unrelated/index.wxml')).toBe(fixture.files['pages/unrelated/index.wxml'])

    const restoredSource = `<template name="card"><view>card ${content}</view></template>`
    await fixture.save('shared/card.wxml', restoredSource)
    harness.change!({ event: 'create', file: card })
    const restored = await fixture.nextBundle(1)
    expect(restored['shared/card.wxml']).toMatchObject({ source: restoredSource })
    expect(fixture.ctx.wxmlService.tokenMap.get(card)?.code).toBe(restoredSource)
    expect(await fixture.readOutput('shared/card.wxml')).toBe(restoredSource)
    expect(await fixture.readOutput('components/layout/index.wxml')).toBe(owner)
    expect(await fixture.readOutput('pages/unrelated/index.wxml')).toBe(fixture.files['pages/unrelated/index.wxml'])
    expect(fixture.failures).toHaveLength(1)
    expect(fixture.failures[0]).toBe(failure)
  })
})
