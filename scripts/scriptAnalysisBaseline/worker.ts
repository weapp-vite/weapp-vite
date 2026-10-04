import type { ScriptCheck, ScriptVariant, ScriptWorkerReport } from './types'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { installScriptBaseline } from './install'
import { scriptScenarios } from './scenarios'
import { SCRIPT_VARIANTS } from './types'

/** 每个实现独占新进程；只比较正确性与实际覆盖计数，不收集耗时。 */
async function main() {
  const variant = process.argv[2] as ScriptVariant
  const output = process.argv[3]
  if (!SCRIPT_VARIANTS.includes(variant) || !output) {
    throw new Error('Expected <script variant> <new output file>')
  }
  const features = {
    astReuse: variant === 'ast-reuse' || variant === 'optimized',
    propsNoScope: variant === 'props-no-scope' || variant === 'optimized',
    pageMetaGate: variant === 'page-meta-gate' || variant === 'optimized',
    reservedPropsGate: variant === 'reserved-props-gate' || variant === 'optimized',
  }
  const installed = variant === 'baseline'
    ? undefined
    : await installScriptBaseline({ mode: variant === 'control' ? 'control' : 'optimized', features })
  const checks: ScriptCheck[] = []
  try {
    const { compileVueFile } = await import('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile')
    const { transformScript } = await import('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript')
    const { warnReservedScriptSetupProps } = await import('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/reservedProps')
    for (const scenario of await scriptScenarios()) {
      const inputSha256 = createHash('sha256').update(JSON.stringify(scenario)).digest('hex')
      for (let iteration = 0; iteration < 2; iteration++) {
        installed?.reset()
        const warnings: string[] = []
        const consoleWarnings: string[] = []
        let value: unknown
        let error: Record<string, unknown> | undefined
        const originalWarn = console.warn
        console.warn = (...args: unknown[]) => consoleWarnings.push(args.map(String).join(' '))
        const warn = scenario.withoutWarn ? undefined : (message: string) => warnings.push(message)
        try {
          if (scenario.kind === 'sfc') {
            value = await compileVueFile(scenario.source, scenario.filename, { ...scenario.options, warn })
          }
          else if (scenario.kind === 'script') {
            value = transformScript(scenario.source, { ...scenario.options, warn })
          }
          else {
            value = warnReservedScriptSetupProps(scenario.source, warn, { filename: scenario.filename, scriptSetupStart: scenario.start })
          }
        }
        catch (cause) {
          error = { name: cause instanceof Error ? cause.name : 'Error', message: cause instanceof Error ? cause.message : String(cause) }
          if (cause && typeof cause === 'object') {
            for (const key of ['code', 'severity', 'filename', 'source', 'loc'] as const) {
              if (key in cause) {
                error[key] = (cause as Record<string, unknown>)[key]
              }
            }
          }
        }
        finally {
          console.warn = originalWarn
        }
        installed?.assertIdle()
        checks.push({
          scenario: scenario.id,
          inputSha256,
          iteration,
          output: JSON.stringify({ value, warnings, consoleWarnings, error }),
          failed: Boolean(error),
          warnings: [...warnings, ...consoleWarnings],
          metrics: { ...installed?.snapshot() },
        })
      }
    }
    const report: ScriptWorkerReport = { variant, sourceHashes: installed?.sourceHashes ?? {}, checks }
    await writeFile(output, `${JSON.stringify(report)}\n`, { flag: 'wx' })
  }
  finally {
    installed?.dispose()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
