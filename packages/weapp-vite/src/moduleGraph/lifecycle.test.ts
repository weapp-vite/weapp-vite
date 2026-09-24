import type { BuildGraphContext, BuildModuleInfo, DevModuleNode, DevServerGraphHost } from './types'
import { describe, expect, it } from 'vitest'
import { createLogicalEntryId } from './protocol'
import { createModuleGraphService } from './service'

function buildContext(owner: string, dependency: string): BuildGraphContext {
  const logicalId = createLogicalEntryId(owner, 'page')
  const modules = new Map<string, BuildModuleInfo>([
    [dependency, { importers: [logicalId] }],
    [logicalId, { isEntry: true }],
  ])
  return {
    getModuleIds: () => modules.keys(),
    getModuleInfo: id => modules.get(id),
    resolve: async source => ({ id: `${owner}/${source}` }),
    load: async () => ({ exports: [owner] }),
  }
}

function devServer(owner: string, dependency: string): DevServerGraphHost {
  const logical: DevModuleNode = { id: createLogicalEntryId(owner, 'page') }
  const source: DevModuleNode = { id: dependency, file: dependency, importers: new Set([logical]) }
  return {
    moduleGraph: {
      getModuleById: id => id === dependency ? source : undefined,
      getModulesByFile: file => file === dependency ? new Set([source]) : undefined,
      invalidateModule() {},
    },
  }
}

describe('module graph scope and session lifetime', () => {
  it('unbinds one scope without losing another scope or its resolver', async () => {
    const service = createModuleGraphService()
    const first = {}
    const second = {}
    const firstContext = buildContext('/src/first.ts', '/src/first-dep.ts')
    const secondContext = buildContext('/src/second.ts', '/src/second-dep.ts')
    service.bindBuildContext(first, firstContext)
    service.bindPluginContext(first, firstContext)
    service.bindBuildContext(second, secondContext)
    service.bindPluginContext(second, secondContext)

    expect(service.collectAffectedEntries('/src/first-dep.ts')).toEqual(new Set(['/src/first.ts']))
    await expect(service.resolve('value')).resolves.toEqual({ id: '/src/second.ts/value' })
    service.unbindBuildContext(second)
    service.unbindBuildContext(second)

    expect(service.hasModule('/src/second-dep.ts')).toBe(false)
    expect(service.collectAffectedEntries('/src/second-dep.ts')).toEqual(new Set())
    expect(service.hasModule('/src/first-dep.ts')).toBe(true)
    expect(service.collectAffectedEntries('/src/first-dep.ts')).toEqual(new Set(['/src/first.ts']))
    await expect(service.resolve('value')).resolves.toEqual({ id: '/src/first.ts/value' })
    await expect(service.load({ id: 'value' })).resolves.toEqual({ exports: ['/src/first.ts'] })
    service.unbindBuildContext(first)
    await expect(service.resolve('value')).rejects.toThrow(TypeError)
    await expect(service.load({ id: 'value' })).rejects.toThrow(TypeError)
  })

  it('keeps a replacement scope active when stale cleanup runs', async () => {
    const scope = {}
    const service = createModuleGraphService()
    const old = buildContext('/src/old.ts', '/src/old-dep.ts')
    const releaseOld = service.bindBuildContext(scope, old)
    service.bindPluginContext(scope, old)
    const current = buildContext('/src/current.ts', '/src/current-dep.ts')
    const releaseCurrent = service.bindBuildContext(scope, current)
    service.bindPluginContext(scope, current)

    releaseOld()
    releaseOld()
    expect(service.hasModule('/src/old-dep.ts')).toBe(false)
    expect(service.collectAffectedEntries('/src/current-dep.ts')).toEqual(new Set(['/src/current.ts']))
    await expect(service.resolve('value')).resolves.toEqual({ id: '/src/current.ts/value' })

    releaseCurrent()
    releaseCurrent()
    expect(service.hasModule('/src/current-dep.ts')).toBe(false)
    await expect(service.load({ id: 'value' })).rejects.toThrow(TypeError)
  })

  it('releases renamed owner dependencies while preserving shared dependencies of surviving owners', () => {
    const service = createModuleGraphService()
    service.replaceEntryDependencies('/src/old.vue', 'style', ['/src/old.css', '/src/shared.css'])
    service.replaceEntryDependencies('/src/other.vue', 'style', ['/src/shared.css'])
    service.replaceEntryDependencies('/src/old.vue', 'layout', ['/src/old-layout.vue'])
    service.removeEntryDependencies('/src/old.vue?raw')
    service.removeEntryDependencies('/src/old.vue')
    service.replaceEntryDependencies('/src/renamed.vue', 'style', ['/src/new.css', '/src/shared.css'])

    expect(service.hasModule('/src/old.vue')).toBe(false)
    expect(service.hasModule('/src/old.css')).toBe(false)
    expect(service.collectAffectedEntries('/src/old.css')).toEqual(new Set())
    expect(service.isLogicalLayoutEntry('/src/old-layout.vue')).toBe(false)
    expect(service.getEntryDependencies('/src/old.vue')).toEqual([])
    expect(service.collectAffectedEntries('/src/shared.css')).toEqual(new Set(['/src/other.vue', '/src/renamed.vue']))
    expect(service.collectAffectedEntries('/src/new.css')).toEqual(new Set(['/src/renamed.vue']))
    service.removeEntryDependencies('/src/renamed.vue')
    expect(service.hasModule('/src/shared.css')).toBe(true)
    expect(service.collectAffectedEntries('/src/shared.css')).toEqual(new Set(['/src/other.vue']))
  })

  it('matches a fresh final session after repeated resets and late old cleanup', async () => {
    const service = createModuleGraphService()
    const snapshot = createModuleGraphService()
    const snapshotContext = buildContext('/snapshot/page.ts', '/snapshot/dep.ts')
    snapshot.bindBuildContext({}, snapshotContext)
    snapshot.bindPluginContext({}, snapshotContext)
    const staleCleanup: Array<() => void> = []
    for (const version of ['first', 'second']) {
      const scope = {}
      const context = buildContext(`/src/${version}.ts`, `/src/${version}-dep.ts`)
      service.bindBuildContext(scope, context)
      staleCleanup.push(() => service.unbindBuildContext(scope))
      service.bindPluginContext(scope, context)
      staleCleanup.push(service.bindDevServer(devServer(`/src/${version}.ts`, '/src/dev-only.ts')))
      service.replaceEntryDependencies(`/src/${version}.ts`, 'template', ['/src/old.wxml'])
      service.recordChangedFile('/src/old.wxml', 'delete')
      service.requestTopologyRescan('delete', '/src/old.wxml')
      service.resetSession()
      service.resetSession()
      expect(service.hasModule('/src/dev-only.ts')).toBe(false)
      await expect(service.resolve('value')).rejects.toThrow(TypeError)
      await expect(service.load({ id: 'value' })).rejects.toThrow(TypeError)
    }
    const fresh = createModuleGraphService()
    for (const target of [service, fresh]) {
      const scope = {}
      const context = buildContext('/src/final.ts', '/src/final-dep.ts')
      target.bindBuildContext(scope, context)
      target.bindPluginContext(scope, context)
    }
    for (const release of staleCleanup) {
      release()
    }
    for (const file of ['/src/first-dep.ts', '/src/second-dep.ts', '/src/dev-only.ts', '/src/old.wxml', '/src/final-dep.ts']) {
      expect(service.hasModule(file)).toBe(fresh.hasModule(file))
      expect(service.collectAffectedEntries(file)).toEqual(fresh.collectAffectedEntries(file))
    }
    expect(service.getPendingChanges()).toEqual([])
    expect(service.consumeTopologyRescan()).toBeUndefined()
    await expect(service.resolve('value')).resolves.toEqual(await fresh.resolve('value'))
    await expect(service.load({ id: 'value' })).resolves.toEqual(await fresh.load({ id: 'value' }))
    expect(snapshot.collectAffectedEntries('/snapshot/dep.ts')).toEqual(new Set(['/snapshot/page.ts']))
    await expect(snapshot.load({ id: 'value' })).resolves.toEqual({ exports: ['/snapshot/page.ts'] })
  })

  it('preserves graph source precedence across server replacement and explicit detachment', () => {
    const service = createModuleGraphService()
    service.bindBuildContext({}, buildContext('/src/build.ts', '/src/shared.ts'))
    const oldRelease = service.bindDevServer(devServer('/src/old-dev.ts', '/src/shared.ts'))
    const currentRelease = service.bindDevServer(devServer('/src/dev.ts', '/src/shared.ts'))
    oldRelease()
    expect(service.collectAffectedEntries('/src/shared.ts')).toEqual(new Set(['/src/dev.ts']))
    currentRelease()
    expect(service.collectAffectedEntries('/src/shared.ts')).toEqual(new Set(['/src/build.ts']))
    service.bindDevServer({ ...devServer('/src/bundled.ts', '/src/shared.ts'), environments: { client: { bundledDev: {} } } })
    expect(service.collectAffectedEntries('/src/shared.ts')).toEqual(new Set(['/src/build.ts']))
    service.bindDevServer(undefined)
    expect(service.collectAffectedEntries('/src/shared.ts')).toEqual(new Set(['/src/build.ts']))
  })

  it('stops in-flight graph warming at the old session boundary', async () => {
    const service = createModuleGraphService()
    const waiting = Promise.withResolvers<void>()
    const started = Promise.withResolvers<void>()
    const old = devServer('/src/old.ts', '/src/old-dep.ts')
    old.transformRequest = async () => {
      started.resolve()
      await waiting.promise
    }
    service.bindDevServer(old)
    const warming = service.syncDevGraph(buildContext('/src/old.ts', '/src/old-dep.ts'))
    await started.promise
    service.resetSession()
    waiting.resolve()
    await warming
    expect(service.hasModule('/src/old-dep.ts')).toBe(false)
    service.bindDevServer(devServer('/src/new.ts', '/src/new-dep.ts'))
    expect(service.collectAffectedEntries('/src/new-dep.ts')).toEqual(new Set(['/src/new.ts']))
  })
})
