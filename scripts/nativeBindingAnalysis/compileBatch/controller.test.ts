import type { TransformContext } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/types'
import type { WevuBindingManifestV1 } from '../../../packages-runtime/wevu-compiler/src/types/bindingManifest'
import type { BindingAnalysis } from '../source'
import type { RecordBinding } from './types'
import { describe, expect, it } from 'vitest'
import { CompileBatchController } from './controller'

function manifest(): WevuBindingManifestV1 {
  return { version: 1, sourceFile: 'fixture.vue', bindings: [], features: {} }
}

function context(): TransformContext {
  return { rewriteScopedSlot: false, scopeStack: [new Set(['local'])], forStack: [], templateSafeCallNames: new Set(['safe']) } as unknown as TransformContext
}

function analysis(expression: string): BindingAnalysis {
  return { dependencies: [{ root: expression, path: expression, mode: 'exact-path' }], snapshotFallback: false }
}

function recorder(controller: CompileBatchController, observed: Array<{ expression: string, analysis: BindingAnalysis | null | undefined }>): RecordBinding {
  const record: RecordBinding = (target, options, current, locals) => {
    if (controller.defer(target, options, current, locals, record, expression => expression)) {
      return
    }
    const result = controller.resolveAnalysis(options.expression, current, locals)?.analysis
    observed.push({ expression: options.expression, analysis: result })
    target.bindings.push({ id: `b${target.bindings.length}`, kind: options.kind, outputPath: options.expression, sourceRoots: [], dependencies: [], scopes: [], updateMode: 'exact-path' })
  }
  return record
}

describe('compile binding batch ownership', () => {
  it('flushes child manifests independently and preserves direct-owner insertion order and IDs', () => {
    const controller = new CompileBatchController({ mode: 'planned-native', binding: { analyzeBindingExpressionsNative: inputs => inputs.map(input => analysis(input.expression)) } })
    const session = controller.beginTemplate()
    const parent = manifest()
    const child = manifest()
    const observed: Parameters<typeof recorder>[1] = []
    const record = recorder(controller, observed)
    record(parent, { kind: 'text', expression: 'before' }, context())
    controller.direct(parent, () => parent.bindings.push({ id: `b${parent.bindings.length}`, kind: 'component-prop', outputPath: 'owner', sourceRoots: [], dependencies: [], scopes: [], updateMode: 'exact-path' }))
    record(child, { kind: 'text', expression: 'child' }, context())
    record(parent, { kind: 'text', expression: 'after' }, context())
    expect(() => controller.reset()).toThrow(/unfinished/)
    controller.flush(child)
    expect(child.bindings.map(binding => binding.outputPath)).toEqual(['child'])
    expect(parent.bindings).toEqual([])
    expect(controller.snapshot()).toMatchObject({ pendingRecords: 3, pendingInputs: 2, nativeCalls: 1 })
    controller.flush(parent)
    controller.finishTemplate(session)
    controller.assertDrained()
    expect(parent.bindings.map(binding => [binding.id, binding.outputPath])).toEqual([['b0', 'before'], ['b1', 'owner'], ['b2', 'after']])
    expect(controller.snapshot()).toMatchObject({ nativeCalls: 2, inputCount: 3, consumedInputs: 3, flushCount: 2, pendingRecords: 0, directRecords: 1 })
  })

  it.each(['throws', 'malformed'] as const)('falls back on %s using frozen requests without reading changed live context', (failure) => {
    const controller = new CompileBatchController({
      mode: 'planned-native',
      binding: {
        analyzeBindingExpressionsNative() {
          if (failure === 'throws') {
            throw new Error('simulated native failure')
          }
          return []
        },
      },
    })
    const analyzed: Array<{ expression: string, locals: string[], safe: string[] }> = []
    controller.setCollector((expression, raw) => {
      const current = raw as TransformContext
      analyzed.push({ expression, locals: [...current.scopeStack[0]!], safe: [...current.templateSafeCallNames] })
      return analysis(expression)
    })
    const session = controller.beginTemplate()
    const target = manifest()
    const live = context()
    const options = { kind: 'text', expression: 'original' } as const
    const observed: Parameters<typeof recorder>[1] = []
    recorder(controller, observed)(target, options, live)
    live.scopeStack[0]!.add('changed')
    live.templateSafeCallNames.clear()
    controller.flush(target)
    controller.finishTemplate(session)
    expect(analyzed).toEqual([{ expression: 'original', locals: ['local'], safe: ['safe'] }])
    expect(observed[0]!.analysis).toEqual(analysis('original'))
    expect(controller.snapshot()).toMatchObject({ fallbackCount: 1, nativeCalls: 1, pendingRecords: 0 })
  })

  it('leaves synthetic bindings eager and reports discarded pending work on template failure', () => {
    const controller = new CompileBatchController({ mode: 'planned-js' })
    const session = controller.beginTemplate()
    const target = manifest()
    expect(controller.defer(target, { kind: 'text', expression: 'synthetic' }, undefined, [], () => {}, expression => expression)).toBe(false)
    controller.resolveAnalysis('synthetic', undefined)
    recorder(controller, [])(target, { kind: 'text', expression: 'queued' }, context())
    expect(() => controller.finishTemplate(session)).toThrow(/pending/)
    controller.abortTemplate(session)
    controller.assertDrained()
    expect(controller.snapshot()).toMatchObject({ unbatchedCalls: 1, abortedTemplates: 1, discardedRecords: 1, pendingRecords: 0 })
  })
})
