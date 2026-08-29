import { describe, expect, it } from 'vitest'
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
    state.glassEasel.detected = true
    state.glassEasel.diagnostics.set('GE001', {
      code: 'GE001',
      severity: 'error',
      message: 'test',
      file: 'app.json',
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
    expect(state.glassEasel.detected).toBe(false)
    expect(state.glassEasel.diagnostics.size).toBe(0)
    expect(state.glassEasel.warnedDiagnostics.size).toBe(0)
    expect(state.scan.isDirty).toBe(true)
  })
})
