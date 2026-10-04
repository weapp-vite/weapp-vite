import type { CompileBatchSnapshot } from '../nativeBindingAnalysis/compileBatch'
import type { BindingNative } from '../nativeBindingAnalysis/replay'
import type { InvokeSfc, ScriptExecutionResult } from '../scriptAnalysisBaseline/execution'
import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { extname, resolve } from 'node:path'
import { installCompileBatch } from '../nativeBindingAnalysis/compileBatch'
import { createScriptExecution } from '../scriptAnalysisBaseline/execution'

export const OPTIMIZED_COMPILER_VARIANTS = ['baseline', 'control', 'optimized-js', 'optimized-summary', 'optimized-native'] as const
export type OptimizedCompilerVariant = typeof OPTIMIZED_COMPILER_VARIANTS[number]
export type NativeFault = 'throw' | 'malformed'

export interface OptimizedCompilerExecutionResult extends ScriptExecutionResult {
  bindingMetrics: Partial<CompileBatchSnapshot>
}

export interface OptimizedCompilerExecutionOptions {
  nativeFault?: NativeFault
  invokeSfc?: InvokeSfc
}

/** 同时保留最早错误和其后的所有释放错误，供诊断报告完整记录。 */
function withCleanupFailure(primary: unknown, cleanup: unknown) {
  const secondary: unknown[] = cleanup instanceof AggregateError ? cleanup.errors : [cleanup]
  return new AggregateError([primary, ...secondary], 'Optimized compiler execution and cleanup failed', { cause: primary })
}

/** 两个加载器逆序释放；即使释放失败也继续回收另一加载器。 */
function disposeOwners(script: Awaited<ReturnType<typeof createScriptExecution>> | undefined, binding: Awaited<ReturnType<typeof installCompileBatch>> | undefined) {
  const failures: unknown[] = []
  for (const owner of [script, binding]) {
    try {
      owner?.dispose()
    }
    catch (error) {
      failures.push(error)
    }
  }
  if (failures.length === 1) {
    throw failures[0]
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Both compiler loaders failed to dispose', { cause: failures[0] })
  }
}

/** 仅供独占新进程的组合诊断；先安装绑定加载器，防止脚本入口提前缓存模板模块。 */
export async function createOptimizedCompilerExecution(variant: OptimizedCompilerVariant, bindingPath?: string) {
  if (!OPTIMIZED_COMPILER_VARIANTS.includes(variant)) {
    throw new Error('Unknown optimized compiler variant')
  }
  let nativeFault: NativeFault | undefined
  let bindingSha256: string | undefined
  let binding: BindingNative | undefined
  if (variant === 'optimized-native') {
    if (!bindingPath || extname(bindingPath) !== '.node') {
      throw new Error('optimized-native requires an explicit .node binding path')
    }
    const absolute = resolve(bindingPath)
    bindingSha256 = createHash('sha256').update(await readFile(absolute)).digest('hex')
    const raw = createRequire(import.meta.url)(absolute) as BindingNative
    if (typeof raw?.analyzeBindingExpressionsNative !== 'function') {
      throw new TypeError('Native binding does not expose analyzeBindingExpressionsNative')
    }
    binding = {
      analyzeBindingExpressionsNative(inputs, ignored) {
        if (nativeFault === 'throw') {
          throw new Error('Injected native execution failure')
        }
        if (nativeFault === 'malformed') {
          return []
        }
        return raw.analyzeBindingExpressionsNative(inputs, ignored)
      },
    }
  }
  let installed: Awaited<ReturnType<typeof installCompileBatch>> | undefined
  let script: Awaited<ReturnType<typeof createScriptExecution>> | undefined
  try {
    if (variant !== 'baseline') {
      installed = await installCompileBatch({
        mode: variant === 'optimized-native' ? 'planned-native' : variant === 'optimized-summary' ? 'planned-summary' : 'control-js',
        binding,
      })
    }
    script = await createScriptExecution(variant === 'baseline' ? 'baseline' : variant === 'control' ? 'control' : 'optimized')
    const sourceHashes = { ...installed?.sourceHashes }
    for (const [filename, digest] of Object.entries(script.sourceHashes)) {
      if (sourceHashes[filename] !== undefined && sourceHashes[filename] !== digest) {
        throw new Error('Compiler loader source hashes disagree')
      }
      sourceHashes[filename] = digest
    }
    const owner = script
    let running = false
    let disposed = false
    return {
      sourceHashes,
      bindingSha256,
      async execute(scenario: ScriptScenario, options: OptimizedCompilerExecutionOptions = {}): Promise<OptimizedCompilerExecutionResult> {
        if (disposed || running) {
          throw new Error('Optimized compiler execution requires an idle, active owner')
        }
        if (options.nativeFault !== undefined && (variant !== 'optimized-native' || !['throw', 'malformed'].includes(options.nativeFault))) {
          throw new Error('Native fault injection requires optimized-native and a supported fault')
        }
        running = true
        let drainChecked = false
        try {
          installed?.reset()
          nativeFault = options.nativeFault
          const result = await owner.execute(scenario, options.invokeSfc)
          drainChecked = true
          installed?.assertDrained()
          return { ...result, bindingMetrics: installed?.snapshot() ?? {} }
        }
        catch (error) {
          if (!drainChecked) {
            try {
              installed?.assertDrained()
            }
            catch (cleanup) {
              throw withCleanupFailure(error, cleanup)
            }
          }
          throw error
        }
        finally {
          nativeFault = undefined
          running = false
        }
      },
      dispose() {
        if (disposed) {
          return
        }
        if (running) {
          throw new Error('Cannot dispose optimized compiler execution while a compile is active')
        }
        disposed = true
        disposeOwners(owner, installed)
      },
    }
  }
  catch (error) {
    try {
      disposeOwners(script, installed)
    }
    catch (cleanup) {
      throw withCleanupFailure(error, cleanup)
    }
    throw error
  }
}
