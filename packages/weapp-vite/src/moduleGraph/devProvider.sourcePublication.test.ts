import type { HmrProfileProvenance } from '../utils/hmrProfile/provenance'
import { describe, expect, it, vi } from 'vitest'
import { compilerSourceId } from '../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion, readCompilerInput } from '../plugins/utils/sourceSnapshot'
import { beginClassicSourcePublication } from '../runtime/buildPlugin/sourcePublication'
import { attachHmrRuntimeSession, createHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { createDevModuleGraphPlugin } from './devProvider'
import { attachDevModuleGraphHost, connectDevModuleGraphHost, notifyDevModuleGraphHost } from './host'

function context() {
  return {
    configService: { cwd: '.', outDir: 'output', inlineConfig: {} },
    moduleGraphService: { bindDevServer: () => () => {}, getTransformDependencies: () => [] },
    runtimeState: {},
  } as any
}

function hotUpdate(plugin: ReturnType<typeof createDevModuleGraphPlugin>, read: () => Promise<string>) {
  return (plugin.hotUpdate as any).call({ environment: { name: 'client' } }, { type: 'update', file: 'src/page.ts', read }) as Promise<void>
}

describe('module graph source observation before asynchronous reads', () => {
  it('captures a save after provider close and graph detach, then completes a cold build already begun in the replacement', async () => {
    const runtime = createHmrRuntimeSession()
    const previousContext = context()
    const oldChanges = vi.fn()
    const oldPlugin = createDevModuleGraphPlugin(previousContext, {}, change => notifyDevModuleGraphHost(previousContext, change))
    const detach = attachDevModuleGraphHost(previousContext, {} as any)
    const provider = connectDevModuleGraphHost(previousContext, oldChanges, change => ({
      ...change,
      sourceEvent: runtime.sourcePublication.observe({ root: 'output', file: compilerSourceId(change.file), version: compilerNativeScriptVersion('A'), eventId: 'late-source-A', event: change.event, receivedAtMs: 1 })?.event,
    }))!
    await provider.close()
    detach()
    const replacement = context()
    const profile: HmrProfileProvenance = {}
    const generations = new Map<string, object>()
    const cold = beginClassicSourcePublication({ inputOwner: replacement.configService, sourceOwner: runtime.sourcePublication, outputRoot: 'output', outputGenerations: generations, profile: () => profile, buildId: 'replacement:1', batchId: () => 'late-batch' })
    const read = Promise.withResolvers<string>()
    const lateUpdate = hotUpdate(oldPlugin, () => read.promise)
    const saved = runtime.sourcePublication.capture('output')
    expect(saved).toHaveLength(1)
    await cold.run(async () => {
      await readCompilerInput(replacement.configService, 'src/page.ts', async () => 'A')
      expect(profile.sourceEvents).toEqual([saved[0]?.event])
      generations.set('output', {})
    })
    expect(runtime.sourcePublication.capture('output')).toEqual(saved)
    cold.finish(true)
    read.resolve('A')
    await lateUpdate
    expect(oldChanges).not.toHaveBeenCalled()
    expect(runtime.sourcePublication.capture('output')).toEqual([])
  })

  it('does not revive command metadata from a retired plugin after terminal close', async () => {
    const runtime = createHmrRuntimeSession()
    const ctx = context()
    const plugin = createDevModuleGraphPlugin(ctx, {}, change => notifyDevModuleGraphHost(ctx, change))
    const detach = attachDevModuleGraphHost(ctx, {} as any)
    const onChange = vi.fn()
    const provider = connectDevModuleGraphHost(ctx, onChange, change => ({ ...change, sourceEvent: runtime.sourcePublication.observe({ root: 'output', file: change.file, version: 'A', eventId: 'terminal-late-A', event: change.event, receivedAtMs: 1 })?.event }))!
    await provider.close()
    detach()
    runtime.sourcePublication.close()
    await hotUpdate(plugin, async () => 'A')
    expect(runtime.sourcePublication.capture('output')).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hands a save through native host replacement without transferring the old graph queue', async () => {
    const runtime = createHmrRuntimeSession()
    const previousContext = context()
    attachHmrRuntimeSession(previousContext, runtime)
    const detach = attachDevModuleGraphHost(previousContext, {} as any)
    const changes = vi.fn()
    connectDevModuleGraphHost(previousContext, changes, change => ({
      ...change,
      sourceEvent: runtime.sourcePublication.observe({ root: 'output', file: compilerSourceId(change.file), version: compilerNativeScriptVersion('A'), eventId: 'source-A', event: change.event, receivedAtMs: 1 })?.event,
    }))
    const oldPlugin = createDevModuleGraphPlugin(previousContext, {}, change => notifyDevModuleGraphHost(previousContext, change))
    const read = Promise.withResolvers<string>()
    const oldUpdate = hotUpdate(oldPlugin, () => read.promise)
    const inherited = runtime.sourcePublication.capture('output')
    expect(inherited).toHaveLength(1)
    expect(changes).not.toHaveBeenCalled()
    detach()
    const replacementContext = context()
    attachHmrRuntimeSession(replacementContext, runtime)
    const replacementChanges = vi.fn()
    attachDevModuleGraphHost(replacementContext, {} as any)
    connectDevModuleGraphHost(replacementContext, replacementChanges)
    const profile: HmrProfileProvenance = {}
    const generations = new Map<string, object>()
    const build = beginClassicSourcePublication({
      inputOwner: replacementContext.configService,
      sourceOwner: runtime.sourcePublication,
      outputRoot: 'output',
      outputGenerations: generations,
      profile: () => profile,
      buildId: 'replacement:1',
      batchId: () => 'replacement-batch',
    })
    expect(profile.buildId).toBe('replacement:1')
    await build.run(async () => {
      await readCompilerInput(replacementContext.configService, 'src/page.ts', async () => 'A')
      expect(profile.sourceEvents).toEqual([inherited[0]?.event])
      generations.set('output', {})
    })
    read.resolve('A')
    await oldUpdate
    expect(changes).not.toHaveBeenCalled()
    expect(replacementChanges).not.toHaveBeenCalled()
    expect(runtime.sourcePublication.capture('output')).toEqual(inherited)
    build.finish(true)
    expect(runtime.sourcePublication.capture('output')).toEqual([])
  })

  it('never replaces B with the late completion of an older A read', async () => {
    const runtime = createHmrRuntimeSession()
    const ctx = context()
    let version = 'A'
    const changes = vi.fn()
    const plugin = createDevModuleGraphPlugin(ctx, {}, changes, change => ({
      ...change,
      sourceEvent: runtime.sourcePublication.observe({ root: 'output', file: compilerSourceId(change.file), version, eventId: `source-${version}`, event: change.event, receivedAtMs: 1 })?.event,
    }))
    const a = Promise.withResolvers<string>()
    const updateA = hotUpdate(plugin, () => a.promise)
    version = 'B'
    await hotUpdate(plugin, async () => 'B')
    const pendingB = runtime.sourcePublication.capture('output')
    a.resolve('A')
    await updateA
    expect(runtime.sourcePublication.capture('output')).toEqual(pendingB)
    expect(changes.mock.calls.map(([change]) => change.sourceEvent?.eventId)).toEqual(['source-B', 'source-A'])
  })
})
