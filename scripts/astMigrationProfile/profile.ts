import type { CompileVueFileOptions } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import type { TransformScriptOptions } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript'
import type { CompilerObservation } from '../../packages-runtime/wevu-compiler/src/profiling/types'
import { compileVueFile } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import { transformScript } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript'
import { observeCompiler, observeCompilerAsync } from '../../packages-runtime/wevu-compiler/src/profiling/node'

function stageTimings(observation: CompilerObservation) {
  const timings: Record<string, number> = {}
  for (const span of observation.spans) {
    timings[span.name] = (timings[span.name] ?? 0) + span.wallMs
  }
  return timings
}

/** 直接观测实际脚本入口；返回值、source map 和 warning 均来自生产实现。 */
export function profileTransformScriptPhases(source: string, options?: TransformScriptOptions) {
  const warnings: string[] = []
  const observed = observeCompiler(() => transformScript(source, {
    ...options,
    warn(message) {
      warnings.push(message)
      options?.warn?.(message)
    },
  }))
  return {
    ...observed,
    code: observed.value.code,
    warnings,
    total: observed.observation.wallMs,
    timings: stageTimings(observed.observation),
  }
}

/** 观测完整真实 SFC 入口，保持样式、宏、默认配置与 source map 的实际执行顺序。 */
export async function profileCompileVueFilePhases(source: string, filename: string, options?: CompileVueFileOptions) {
  const warnings: string[] = []
  const observed = await observeCompilerAsync(() => compileVueFile(source, filename, {
    ...options,
    warn(message) {
      warnings.push(message)
      options?.warn?.(message)
    },
  }))
  return {
    ...observed,
    warnings,
    total: observed.observation.wallMs,
    phases: stageTimings(observed.observation),
  }
}
