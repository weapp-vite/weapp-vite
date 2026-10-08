import type { ScriptScenario, ScriptVariant } from './types'
import { createHash } from 'node:crypto'
import { installScriptBaseline } from './install'
import { SCRIPT_VARIANTS } from './types'

export type InvokeSfc = (compile: () => Promise<unknown>) => Promise<unknown>

export interface ScriptExecutionResult {
  output: string
  inputSha256: string
  failed: boolean
  warnings: string[]
  metrics: Record<string, unknown>
}

function diagnosticError(cause: unknown) {
  const error: Record<string, unknown> = {
    name: cause instanceof Error ? cause.name : 'Error',
    message: cause instanceof Error ? cause.message : String(cause),
  }
  if (cause && typeof cause === 'object') {
    for (const key of ['code', 'severity', 'filename', 'source', 'loc'] as const) {
      if (key in cause) {
        error[key] = (cause as Record<string, unknown>)[key]
      }
    }
  }
  return error
}

/** 正确性与计时入口共用同一执行、告警捕获和序列化契约；加载器仅属于当前新进程。 */
export async function createScriptExecution(variant: ScriptVariant) {
  if (!SCRIPT_VARIANTS.includes(variant)) {
    throw new Error('Unknown script execution variant')
  }
  const installed = variant === 'baseline'
    ? undefined
    : await installScriptBaseline({
        mode: variant === 'control' ? 'control' : 'optimized',
        features: {
          astReuse: variant === 'ast-reuse' || variant === 'optimized',
          propsNoScope: variant === 'props-no-scope' || variant === 'optimized',
          pageMetaGate: variant === 'page-meta-gate' || variant === 'optimized',
          reservedPropsGate: variant === 'reserved-props-gate' || variant === 'optimized',
        },
      })
  try {
    const { compileVueFile } = await import('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile')
    const { transformScript } = await import('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript')
    const { warnReservedScriptSetupProps } = await import('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/reservedProps')
    let running = false
    let disposed = false
    return {
      sourceHashes: installed?.sourceHashes ?? {},
      async execute(scenario: ScriptScenario, invokeSfc: InvokeSfc = compile => compile()): Promise<ScriptExecutionResult> {
        if (disposed || running) {
          throw new Error('Script execution requires an idle, active owner')
        }
        running = true
        try {
          installed?.reset()
          const inputSha256 = createHash('sha256').update(JSON.stringify(scenario)).digest('hex')
          const warnings: string[] = []
          const consoleWarnings: string[] = []
          let value: unknown
          let error: Record<string, unknown> | undefined
          const originalWarn = console.warn
          console.warn = (...args: unknown[]) => consoleWarnings.push(args.map(String).join(' '))
          const warn = scenario.withoutWarn ? undefined : (message: string) => warnings.push(message)
          try {
            if (scenario.kind === 'sfc') {
              const source = scenario.source
              const filename = scenario.filename
              const options = { ...scenario.options, warn }
              value = await invokeSfc(() => compileVueFile(source, filename, options))
            }
            else if (scenario.kind === 'script') {
              value = transformScript(scenario.source, { ...scenario.options, warn })
            }
            else {
              value = warnReservedScriptSetupProps(scenario.source, warn, { filename: scenario.filename, scriptSetupStart: scenario.start })
            }
          }
          catch (cause) {
            error = diagnosticError(cause)
          }
          finally {
            console.warn = originalWarn
          }
          installed?.assertIdle()
          return {
            output: JSON.stringify({ value, warnings, consoleWarnings, error }),
            inputSha256,
            failed: Boolean(error),
            warnings: [...warnings, ...consoleWarnings],
            metrics: { ...installed?.snapshot() },
          }
        }
        finally {
          running = false
        }
      },
      dispose() {
        if (disposed) {
          return
        }
        if (running) {
          throw new Error('Cannot dispose script execution while a compile is active')
        }
        disposed = true
        installed?.dispose()
      },
    }
  }
  catch (error) {
    installed?.dispose()
    throw error
  }
}
