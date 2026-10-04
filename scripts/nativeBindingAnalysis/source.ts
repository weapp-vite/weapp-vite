import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'

export interface BindingInput {
  expression: string
  locals: string[]
  safeCallNames: string[]
}

export interface BindingAnalysis {
  dependencies: Array<{ root: string, path?: string, mode: 'exact-path' | 'top-level' }>
  snapshotFallback: boolean
}

export interface BindingSyntaxSummary {
  readonly dependencies: readonly Readonly<BindingAnalysis['dependencies'][number]>[]
  readonly directCallNames: readonly string[]
  readonly unconditionalSnapshotFallback: boolean
}

const sourceUrl = new URL('../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/bindingManifest.ts', import.meta.url)
const anchor = 'const parsed = parseBabelExpressionFile(normalized)'
const analysisAnchor = 'if (localNames.size && context) {'
const normalizationAnchor = `const normalized = context
    ? normalizeWxmlExpressionWithContext(expression, context)
    : expression`
const captureKey = '__weappViteExperimentalBindingCapture'

/** 诊断进程复用生产私有分析函数；源码、公开 API 和 dist 均不改变。 */
export async function loadProductionBindingAnalysis(options: { capture?: boolean } = {}) {
  let loaded = 0
  let record: ((input: BindingInput) => ((analysis: BindingAnalysis) => void)) | undefined
  const originalSource = readFileSync(sourceUrl, 'utf8')
  const source = originalSource.replaceAll('\r\n', '\n')
  if (source.split(anchor).length !== 2 || source.split(analysisAnchor).length !== 2 || source.split(normalizationAnchor).length !== 2) {
    throw new Error('Production binding analysis anchor changed')
  }
  if (Object.hasOwn(globalThis, captureKey)) {
    throw new Error('Binding capture already installed')
  }
  Object.defineProperty(globalThis, captureKey, {
    configurable: true,
    value(expression: string, locals: string[], safeCallNames: string[]) {
      return record?.({ expression, locals, safeCallNames })
    },
  })
  const captureSource = options.capture
    ? source.replace(anchor, `const reportBindingAnalysis = globalThis.${captureKey}?.(normalized, [...new Set([...(context?.scopeStack ?? []).flatMap(scope => [...scope]), ...additionalLocals ?? []])], [...context?.templateSafeCallNames ?? []]);\n${anchor}`)
        .replace(analysisAnchor, `reportBindingAnalysis?.({ dependencies: [...dependencies.values()], snapshotFallback });\n${analysisAnchor}`)
    : source.replace(normalizationAnchor, 'const normalized = expression')
  const hooked = `${captureSource
  }\nexport { collectDependencies as experimentalCollectDependencies };\n`
  const hook = registerHooks({
    load(url, context, nextLoad) {
      if (url !== sourceUrl.href) {
        return nextLoad(url, context)
      }
      loaded++
      return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(hooked, { mode: 'strip' }) }
    },
  })
  const dispose = () => {
    record = undefined
    hook.deregister()
    delete (globalThis as unknown as Record<string, unknown>)[captureKey]
  }
  let module: { experimentalCollectDependencies: (expression: string, context: unknown) => BindingAnalysis | null }
  try {
    module = await import(sourceUrl.href) as typeof module
    if (loaded !== 1 || typeof module.experimentalCollectDependencies !== 'function') {
      throw new Error('Expected a fresh diagnostic process with one production binding module')
    }
  }
  catch (error) {
    dispose()
    throw error
  }
  return {
    sourceSha256: createHash('sha256').update(originalSource).digest('hex'),
    setRecorder(callback?: typeof record) { record = callback },
    analyze(input: BindingInput) {
      return module.experimentalCollectDependencies(input.expression, {
        rewriteScopedSlot: false,
        scopeStack: [new Set(input.locals)],
        forStack: [],
        templateSafeCallNames: new Set(input.safeCallNames),
      })
    },
    summarize(expression: string): BindingSyntaxSummary | null {
      if (options.capture) {
        throw new Error('Syntax summaries require replay mode with normalized expressions')
      }
      const directCallNames = new Set<string>()
      const analysis = module.experimentalCollectDependencies(expression, {
        rewriteScopedSlot: false,
        scopeStack: [],
        forStack: [],
        // 仅在诊断中观察生产 visitor 的安全调用查询，不复制解析、作用域和遍历逻辑。
        templateSafeCallNames: {
          has(name: string) {
            directCallNames.add(name)
            return true
          },
        },
      })
      if (!analysis) {
        return null
      }
      return Object.freeze({
        dependencies: Object.freeze(analysis.dependencies.map(dependency => Object.freeze(dependency))),
        directCallNames: Object.freeze([...directCallNames]),
        unconditionalSnapshotFallback: analysis.snapshotFallback,
      })
    },
    dispose,
  }
}
