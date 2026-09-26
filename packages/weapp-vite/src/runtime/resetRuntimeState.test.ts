import type { MutableCompilerContext } from '../context'
import { describe, expect, it } from 'vitest'
import { createAutoRoutesService } from './autoRoutesPlugin/service'
import { resetRuntimeStateForFreshBuild } from './resetRuntimeState'
import { createRuntimeState } from './runtimeState'

describe('runtime state fresh build reset', () => {
  it('clears graph-scoped compiler caches while preserving process-scoped services', () => {
    const state = createRuntimeState()
    const queue = state.build.queue
    const watcher = state.watcher
    const previousHmr = state.build.hmr

    state.autoImport.version = 4
    const component = {
      kind: 'local' as const,
      entry: {
        path: '/project/src/components/Button.vue',
        json: { component: true },
        jsonPath: '/project/src/components/Button.vue',
        type: 'component' as const,
        templatePath: '/project/src/components/Button.vue',
      },
      value: {
        name: 'Button',
        from: '/components/Button',
        resolvedId: '/project/src/components/Button.vue',
      },
    }
    state.autoImport.registry.set('Button', component)
    state.autoImport.normalizedLocalComponents.set('button', component)
    state.build.hmr.loadedEntrySet.add('/project/src/pages/index.ts')
    state.json.emittedSource.set('app.json', '{}')
    state.css.transformedSidecarSource.set('/project/src/pages/index/index.css', {
      code: '.pre-plugin {}',
      diskSource: '.disk {}',
    })
    state.css.emittedSource.set('app.wxss', '.page {}')
    state.wxml.emittedCode.set('pages/index/index.wxml', '<view />')
    state.scan.warnedMessages.add('warning')
    state.glassEasel.analysisByOwner.set('output:main:app.json', {
      kind: 'output',
      scope: 'main',
      detected: true,
      diagnostics: new Map([['GE001', {
        code: 'GE001',
        severity: 'error',
        message: 'test',
        file: 'app.json',
      }]]),
      sourceIds: new Set(['app.json']),
    })
    state.glassEasel.warnedDiagnostics.add('GE001')

    resetRuntimeStateForFreshBuild(state)

    expect(state.build.queue).toBe(queue)
    expect(state.watcher).toBe(watcher)
    expect(state.build.hmr).not.toBe(previousHmr)
    expect(state.build.hmr.loadedEntrySet.size).toBe(0)
    expect(state.autoImport.version).toBe(5)
    expect(state.autoImport.registry.size).toBe(0)
    expect(state.autoImport.normalizedLocalComponents.size).toBe(0)
    expect(state.json.emittedSource.size).toBe(0)
    expect(state.css.transformedSidecarSource.size).toBe(0)
    expect(state.css.emittedSource.size).toBe(0)
    expect(state.wxml.emittedCode.size).toBe(0)
    expect(state.scan.warnedMessages.size).toBe(0)
    expect(state.glassEasel.analysisByOwner.size).toBe(0)
    expect(state.glassEasel.warnedDiagnostics.size).toBe(0)
    expect(state.scan.isDirty).toBe(true)
  })

  it('invalidates named-route and external declaration snapshots before the next scan', () => {
    const state = createRuntimeState()
    const pageSource = '/project/src/pages/stale/index.vue'
    const externalSource = '/project/src/pageScripts/stale.ts'
    state.autoRoutes.namedRoutes = [{
      name: 'stale',
      path: '/pages/stale/index',
      meta: {},
    }]
    state.autoRoutes.namedModuleCode = 'export const routes = [{ name: "stale" }]'
    state.autoRoutes.pageDeclarationDependencies.set(externalSource, new Set([pageSource]))
    state.autoRoutes.pageSourceFiles.add(pageSource)
    state.autoRoutes.namedRouteSourceFiles.add(pageSource)
    state.autoRoutes.watchFiles.add(externalSource)
    state.autoRoutes.initialized = true
    state.autoRoutes.dirty = false
    state.autoRoutes.needsFullRescan = false

    const service = createAutoRoutesService({
      runtimeState: state,
      configService: {
        weappViteConfig: {
          autoRoutes: true,
        },
      },
    } as MutableCompilerContext)
    expect(service.getNamedModuleCode()).toContain('stale')
    expect([...service.getPageDeclarationOwners(externalSource)]).toEqual([pageSource])

    resetRuntimeStateForFreshBuild(state)

    expect(service.getNamedModuleCode()).not.toContain('stale')
    expect([...service.getPageDeclarationOwners(externalSource)]).toEqual([])
    expect([...service.getWatchFiles()]).toEqual([])
    expect(service.isInitialized()).toBe(false)
  })
})
