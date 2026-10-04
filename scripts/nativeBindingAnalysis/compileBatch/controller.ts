import type { TransformContext } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/types'
import type { WevuBindingManifestV1 } from '../../../packages-runtime/wevu-compiler/src/types/bindingManifest'
import type { BindingAnalysis, BindingInput, BindingSyntaxSummary } from '../source'
import type { CompileBatchMetrics, CompileBatchOptions, CompileBatchSnapshot, NormalizeBinding, ProductionCollector, RecordBinding, RecordOptions } from './types'
import { replayWithFallback, replayWithJs, replayWithJsSummary } from '../replay'
import { bindingInput, planBindingRecord } from './plan'

interface Operation {
  inputs: BindingInput[]
  apply: () => void
}

interface TemplateSession {
  manifests: Set<WevuBindingManifestV1>
}

function emptyMetrics(): CompileBatchMetrics {
  return {
    inputCount: 0,
    uniqueInputCount: 0,
    consumedInputs: 0,
    unusedPreparedInputs: 0,
    nativeCalls: 0,
    fallbackCount: 0,
    fallbackReasons: [],
    flushCount: 0,
    queuedRecords: 0,
    directRecords: 0,
    unbatchedCalls: 0,
    baseJsCalls: 0,
    abortedTemplates: 0,
    discardedRecords: 0,
  }
}

/** 一次真实模板遍历内暂存请求；每个 manifest 首次同步消费前分析并原序回放。 */
export class CompileBatchController {
  private metrics = emptyMetrics()
  private queues = new Map<WevuBindingManifestV1, Operation[]>()
  private sessions: TemplateSession[] = []
  private phase: 'idle' | 'base' | 'materialize' = 'idle'
  private results?: Map<string, BindingAnalysis | null>
  private collect?: ProductionCollector

  constructor(private options: CompileBatchOptions) {}

  setCollector(collect: ProductionCollector) {
    this.collect = collect
  }

  skipNormalization() {
    return this.phase !== 'idle'
  }

  resolveAnalysis(expression: string, context?: TransformContext, additionalLocals?: Iterable<string>) {
    if (this.phase !== 'materialize') {
      if (this.phase === 'idle') {
        this.metrics.unbatchedCalls++
      }
      else {
        this.metrics.baseJsCalls++
      }
      return undefined
    }
    const key = JSON.stringify(bindingInput(expression, context, additionalLocals))
    if (!this.results?.has(key)) {
      throw new Error('Compile batch replay requested an unplanned frozen input')
    }
    this.metrics.consumedInputs++
    return { analysis: this.results.get(key)! }
  }

  private base<T>(callback: (collect: ProductionCollector) => T) {
    if (!this.collect) {
      throw new Error('Compile batch production collector not loaded')
    }
    const previous = this.phase
    this.phase = 'base'
    try {
      return callback(this.collect)
    }
    finally {
      this.phase = previous
    }
  }

  private analyze = (input: BindingInput) => this.base(collect => collect(input.expression, {
    rewriteScopedSlot: false,
    scopeStack: [new Set(input.locals)],
    forStack: [],
    templateSafeCallNames: new Set(input.safeCallNames),
  }))

  private summarize = (expression: string): BindingSyntaxSummary | null => this.base((collect) => {
    const directCallNames = new Set<string>()
    const analysis = collect(expression, {
      rewriteScopedSlot: false,
      scopeStack: [],
      forStack: [],
      templateSafeCallNames: {
        has(name: string) {
          directCallNames.add(name)
          return true
        },
      },
    })
    return analysis && Object.freeze({
      dependencies: Object.freeze(analysis.dependencies.map(dependency => Object.freeze(dependency))),
      directCallNames: Object.freeze([...directCallNames]),
      unconditionalSnapshotFallback: analysis.snapshotFallback,
    })
  })

  beginTemplate() {
    const session: TemplateSession = { manifests: new Set() }
    this.sessions.push(session)
    return session
  }

  finishTemplate(session: TemplateSession) {
    if (this.sessions.at(-1) !== session || [...session.manifests].some(manifest => this.queues.has(manifest))) {
      throw new Error('Compile batch template ended with pending manifests or mismatched lifecycle')
    }
    this.sessions.pop()
  }

  abortTemplate(session: TemplateSession) {
    if (this.sessions.at(-1) !== session) {
      throw new Error('Compile batch abort lifecycle mismatch')
    }
    for (const manifest of session.manifests) {
      this.metrics.discardedRecords += this.queues.get(manifest)?.length ?? 0
      this.queues.delete(manifest)
    }
    this.metrics.abortedTemplates++
    this.sessions.pop()
  }

  private enqueue(manifest: WevuBindingManifestV1, operation: Operation) {
    const session = this.sessions.at(-1)
    if (!session) {
      throw new Error('Compile batch enqueue outside a template session')
    }
    session.manifests.add(manifest)
    const queue = this.queues.get(manifest) ?? []
    queue.push(operation)
    this.queues.set(manifest, queue)
    this.metrics.inputCount += operation.inputs.length
  }

  defer(manifest: WevuBindingManifestV1, options: RecordOptions, context: TransformContext | undefined, additionalLocals: Iterable<string> | undefined, record: RecordBinding, normalize: NormalizeBinding) {
    // 合成绑定没有模板消费边界，继续同步分析；回放不得再次排队。
    if (this.phase !== 'idle' || !context || !this.sessions.length) {
      return false
    }
    const planned = planBindingRecord(options, context, additionalLocals, normalize)
    this.enqueue(manifest, { inputs: planned.inputs, apply: () => record(manifest, planned.options, planned.context, planned.additionalLocals) })
    this.metrics.queuedRecords++
    return true
  }

  direct(manifest: WevuBindingManifestV1, apply: () => void) {
    this.enqueue(manifest, { inputs: [], apply })
    this.metrics.directRecords++
  }

  flush(manifest: WevuBindingManifestV1) {
    const queue = this.queues.get(manifest)
    if (!queue) {
      return
    }
    if (this.phase !== 'idle') {
      throw new Error('Compile batch flush must be synchronous and non-reentrant')
    }
    const inputs = queue.flatMap(operation => operation.inputs)
    const keys = inputs.map(input => JSON.stringify(input))
    this.metrics.uniqueInputCount += new Set(keys).size
    let results: Array<BindingAnalysis | null>
    if (this.options.mode === 'planned-native') {
      const binding = this.options.binding!
      const replay = replayWithFallback(inputs, {
        analyzeBindingExpressionsNative: (requests, ignoredGlobals) => {
          this.metrics.nativeCalls++
          return binding.analyzeBindingExpressionsNative(requests, ignoredGlobals)
        },
      }, this.options.ignoredGlobals ?? [], this.analyze)
      results = replay.results
      if (replay.fallback) {
        this.metrics.fallbackCount++
        this.metrics.fallbackReasons.push(replay.fallback)
      }
    }
    else {
      results = this.options.mode === 'planned-summary'
        ? replayWithJsSummary(inputs, this.summarize)
        : replayWithJs(inputs, this.analyze, true)
    }
    this.results = new Map(keys.map((key, index) => [key, results[index]!]))
    const consumedBefore = this.metrics.consumedInputs
    this.phase = 'materialize'
    try {
      for (const operation of queue) {
        operation.apply()
      }
      this.queues.delete(manifest)
      this.metrics.flushCount++
      this.metrics.unusedPreparedInputs += inputs.length - (this.metrics.consumedInputs - consumedBefore)
    }
    finally {
      this.phase = 'idle'
      this.results = undefined
    }
  }

  snapshot(): CompileBatchSnapshot {
    const operations = [...this.queues.values()].flat()
    return {
      ...this.metrics,
      fallbackReasons: [...this.metrics.fallbackReasons],
      pendingRecords: operations.length,
      pendingInputs: operations.reduce((sum, operation) => sum + operation.inputs.length, 0),
      activeTemplates: this.sessions.length,
    }
  }

  assertDrained() {
    if (this.queues.size || this.sessions.length || this.phase !== 'idle') {
      throw new Error('Compile batch contains unfinished template work')
    }
  }

  reset() {
    this.assertDrained()
    this.metrics = emptyMetrics()
  }
}
