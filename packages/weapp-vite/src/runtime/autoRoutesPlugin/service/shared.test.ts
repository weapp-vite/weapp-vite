import type { NamedAutoRoute } from '../types'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtimeState'
import {
  createAutoRoutesArtifacts,
  createAutoRoutesModuleCode,
  createEmptyAutoRoutesSnapshot,
  resetAutoRoutesState,
} from './shared'

describe('auto routes shared artifacts', () => {
  it('creates consistent artifacts from a route snapshot', () => {
    const snapshot = {
      pages: ['pages/index/index'],
      entries: ['pages/index/index', 'packageA/pages/demo'],
      subPackages: [{ root: 'packageA', pages: ['pages/demo'] }],
    }
    const meta = JSON.parse('{"title":"Demo","__proto__":{"polluted":true}}') as NamedAutoRoute['meta']

    const artifacts = createAutoRoutesArtifacts(snapshot, [{
      name: 'demo',
      path: '/packageA/pages/demo',
      meta,
    }])

    expect(artifacts.serialized).toBe(JSON.stringify(snapshot, null, 2))
    expect(artifacts.moduleCode).toBe(createAutoRoutesModuleCode(artifacts.serialized))
    expect(artifacts.moduleCode).toContain('const routes = ')
    expect(artifacts.moduleCode).toContain('globalThis.wx ?? globalThis.tt ?? globalThis.my ?? globalThis.swan ?? globalThis.jd ?? globalThis.xhs')
    expect(artifacts.moduleCode).toContain('const wxRouter = miniProgramRouter;')
    expect(artifacts.moduleCode).toContain('export { routes, pages, entries, subPackages, wxRouter, miniProgramRouter };')
    expect(artifacts.typedDefinition).toContain('AutoRoutesMiniProgramRouter')
    expect(artifacts.namedModuleCode).toContain('export const routes = JSON.parse(')
    expect(artifacts.namedModuleCode).not.toContain('import ')
    const payloadLiteral = artifacts.namedModuleCode.slice('export const routes = JSON.parse('.length, -3)
    const serialized: unknown = JSON.parse(payloadLiteral)
    if (typeof serialized !== 'string') {
      throw new TypeError('Expected serialized named routes')
    }
    const routes = JSON.parse(serialized) as NamedAutoRoute[]
    const route = routes[0]
    if (!route) {
      throw new Error('Expected one named route')
    }
    expect(route).toMatchObject({
      name: 'demo',
      path: '/packageA/pages/demo',
      meta: { title: 'Demo' },
    })
    expect(Object.hasOwn(route.meta, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(route.meta, '__proto__')?.value).toEqual({ polluted: true })
    expect(Object.getPrototypeOf(route.meta)).toBe(Object.prototype)
    expect(artifacts.signature).toContain('"namedRoutes"')
  })

  it('resets runtime auto routes state with shared empty artifacts', () => {
    const state = createRuntimeState().autoRoutes
    state.routes.pages.push('pages/stale/index')
    state.serialized = 'stale'
    state.moduleCode = 'stale'
    state.namedRoutes.push({ name: 'stale', path: '/pages/stale/index', meta: {} })
    state.typedDefinition = 'stale'
    state.namedModuleCode = 'stale'
    state.signature = 'stale'
    state.topologyKey = 'stale'
    state.watchFiles.add('/tmp/file')
    state.pageSourceFiles.add('/tmp/page.ts')
    state.namedRouteSourceFiles.add('/tmp/page.ts')
    state.pageDeclarationDependencies.set('/tmp/external.ts', new Set(['/tmp/page.vue']))
    state.pageDeclarationFingerprints.set('/tmp/external.ts', 'fingerprint')
    state.usesOpaquePageDeclarationResolver = true
    state.watchDirs.add('/tmp/dir')
    state.dirty = true
    state.initialized = false
    state.needsFullRescan = false
    state.candidates.set('stale', { base: 'stale', files: new Set(), hasScript: false, hasTemplate: false })

    resetAutoRoutesState(state)

    const emptySnapshot = createEmptyAutoRoutesSnapshot()
    const emptyArtifacts = createAutoRoutesArtifacts(emptySnapshot)
    expect(state.routes).toEqual(emptySnapshot)
    expect(state.serialized).toBe(emptyArtifacts.serialized)
    expect(state.moduleCode).toBe(emptyArtifacts.moduleCode)
    expect(state.namedRoutes).toEqual([])
    expect(state.typedDefinition).toBe(emptyArtifacts.typedDefinition)
    expect(state.namedModuleCode).toBe(emptyArtifacts.namedModuleCode)
    expect(state.signature).toBe(emptyArtifacts.signature)
    expect(state.topologyKey).toBe('')
    expect(state.watchFiles.size).toBe(0)
    expect(state.pageSourceFiles.size).toBe(0)
    expect(state.namedRouteSourceFiles.size).toBe(0)
    expect(state.pageDeclarationDependencies.size).toBe(0)
    expect(state.pageDeclarationFingerprints.size).toBe(0)
    expect(state.usesOpaquePageDeclarationResolver).toBe(false)
    expect(state.watchDirs.size).toBe(0)
    expect(state.dirty).toBe(false)
    expect(state.initialized).toBe(true)
    expect(state.needsFullRescan).toBe(true)
    expect(state.candidates.size).toBe(0)
  })
})
