import type { Profiler } from 'node:inspector'
import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import type { createCompilerCpuProfiler } from './cpu'
import type { createOptimizedCompilerExecution, OptimizedCompilerExecutionResult, OptimizedCompilerVariant } from './execution'
import type { OptimizedCheck } from './verify'
import { digest } from './identity'
import { verifyOptimizedCheck } from './verify'

export const CPU_WARMUP_ROUNDS = 14
export const CPU_SAMPLE_ROUNDS = 20
export type CpuPhase = 'initial' | 'warmup' | 'sample'
export interface CpuProfileArtifact {
  index: number
  file: string
  sha256: string
  startTime: number
  endTime: number
  durationMicroseconds: number
  sampleCount: number
}
export interface CpuObservation extends Omit<OptimizedCheck, 'output'> {
  phase: CpuPhase
  index: number
  outputSha256: string
}
export interface CpuWorkloadState {
  initialOutput?: string
  observations: CpuObservation[]
  profileArtifacts: CpuProfileArtifact[]
  failures: unknown[]
  mismatch?: { phase: CpuPhase, index: number, expected?: string, actual?: OptimizedCompilerExecutionResult }
}
interface CpuWorkloadDependencies {
  execution: Pick<Awaited<ReturnType<typeof createOptimizedCompilerExecution>>, 'execute'>
  profiler: Pick<Awaited<ReturnType<typeof createCompilerCpuProfiler>>, 'measure'>
  saveProfile: (index: number, profile: Profiler.Profile) => Promise<CpuProfileArtifact>
}

/** 每轮图只在当前调用内持有；哈希、指标、输出比对和落盘均在 inspector 停止后执行。 */
async function observe(
  scenario: ScriptScenario,
  variant: OptimizedCompilerVariant,
  phase: CpuPhase,
  index: number,
  state: CpuWorkloadState,
  dependencies: CpuWorkloadDependencies,
) {
  let profile: Profiler.Profile | undefined
  let invocations = 0
  const invocationErrors: unknown[] = []
  let result: OptimizedCompilerExecutionResult | undefined
  try {
    result = await dependencies.execution.execute(scenario, phase === 'sample'
      ? {
          invokeSfc: async (compile) => {
            invocations++
            try {
              const sampled = await dependencies.profiler.measure(compile)
              profile = sampled.profile
              return sampled.value
            }
            catch (error) {
              invocationErrors.push(error)
              throw error
            }
          },
        }
      : undefined)
    if (phase === 'initial') {
      state.initialOutput = result.output
    }
    if (profile) {
      state.profileArtifacts.push(await dependencies.saveProfile(index, profile))
      profile = undefined
    }
    if (invocationErrors.length) {
      throw new AggregateError(invocationErrors, 'Sampled compilation failed inside the inspector window')
    }
    if (phase === 'sample' && invocations !== 1) {
      throw new Error('CPU observation requires exactly one compileVueFile invocation')
    }
    const iteration = index
    const checked = verifyOptimizedCheck({ scenario: scenario.id, iteration, ...result }, { scenario, bindingCoverage: 'batched' }, variant, iteration)
    if (checked.output !== state.initialOutput) {
      throw new Error('Complete output, sourcemap, warnings or diagnostics changed during CPU sampling')
    }
    const { output, ...evidence } = checked
    state.observations.push({ phase, index, ...evidence, outputSha256: digest(output) })
  }
  catch (error) {
    state.mismatch = { phase, index, expected: state.initialOutput, actual: result }
    // execute 会序列化编译异常；另行保留原始 inspector/编译错误及其嵌套原因。
    state.failures.push(...invocationErrors, error)
    throw error
  }
}

/** 固定一轮初始校验、十四轮预热和二十轮采样；任何失败后停止后续编译。 */
export async function collectCompilerCpuWorkload(scenario: ScriptScenario, variant: OptimizedCompilerVariant, dependencies: CpuWorkloadDependencies): Promise<CpuWorkloadState> {
  const state: CpuWorkloadState = { observations: [], profileArtifacts: [], failures: [] }
  try {
    if (scenario.kind !== 'sfc' || scenario.expectError) {
      throw new Error('CPU workload requires a valid SFC scenario')
    }
    await observe(scenario, variant, 'initial', 0, state, dependencies)
    for (let index = 0; index < CPU_WARMUP_ROUNDS; index++) {
      await observe(scenario, variant, 'warmup', index, state, dependencies)
    }
    for (let index = 0; index < CPU_SAMPLE_ROUNDS; index++) {
      await observe(scenario, variant, 'sample', index, state, dependencies)
    }
  }
  catch (error) {
    if (!state.failures.length) {
      state.failures.push(error)
    }
  }
  return state
}
