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
    state.autoImport.registry.set('Button', {} as any)
    state.build.hmr.loadedEntrySet.add('/project/src/pages/index.ts')
    state.json.emittedSource.set('app.json', '{}')
    state.css.emittedSource.set('app.wxss', '.page {}')
    state.wxml.emittedCode.set('pages/index/index.wxml', '<view />')
    state.scan.warnedMessages.add('warning')

    resetRuntimeStateForFreshBuild(state)

    expect(state.build.queue).toBe(queue)
    expect(state.watcher).toBe(watcher)
    expect(state.build.hmr).not.toBe(previousHmr)
    expect(state.build.hmr.loadedEntrySet.size).toBe(0)
    expect(state.autoImport.version).toBe(5)
    expect(state.autoImport.registry.size).toBe(0)
    expect(state.json.emittedSource.size).toBe(0)
    expect(state.css.emittedSource.size).toBe(0)
    expect(state.wxml.emittedCode.size).toBe(0)
    expect(state.scan.warnedMessages.size).toBe(0)
    expect(state.scan.isDirty).toBe(true)
  })
})
