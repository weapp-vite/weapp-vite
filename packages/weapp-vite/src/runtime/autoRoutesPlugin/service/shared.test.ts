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

    const artifacts = createAutoRoutesArtifacts(snapshot)

    expect(artifacts.serialized).toBe(JSON.stringify(snapshot, null, 2))
    expect(artifacts.moduleCode).toBe(createAutoRoutesModuleCode(artifacts.serialized))
    expect(artifacts.moduleCode).toContain('const routes = ')
    expect(artifacts.moduleCode).toContain('globalThis.wx ?? globalThis.tt ?? globalThis.my ?? globalThis.swan ?? globalThis.jd ?? globalThis.xhs')
    expect(artifacts.moduleCode).toContain('const wxRouter = miniProgramRouter;')
    expect(artifacts.moduleCode).toContain('export { routes, pages, entries, subPackages, wxRouter, miniProgramRouter };')
    expect(artifacts.typedDefinition).toContain('AutoRoutesMiniProgramRouter')
  })

  it('resets runtime auto routes state with shared empty artifacts', () => {
    const state = createRuntimeState().autoRoutes
    state.routes.pages.push('pages/stale/index')
    state.serialized = 'stale'
    state.moduleCode = 'stale'
    state.typedDefinition = 'stale'
    state.watchFiles.add('/tmp/file')
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
    expect(state.typedDefinition).toBe(emptyArtifacts.typedDefinition)
    expect(state.watchFiles.size).toBe(0)
    expect(state.watchDirs.size).toBe(0)
    expect(state.dirty).toBe(false)
    expect(state.initialized).toBe(true)
    expect(state.needsFullRescan).toBe(true)
    expect(state.candidates.size).toBe(0)
  })
})
