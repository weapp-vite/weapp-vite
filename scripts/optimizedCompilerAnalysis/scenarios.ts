import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import { compileScenarios } from '../nativeBindingAnalysis/compileScenarios'
import { scriptScenarios } from '../scriptAnalysisBaseline/scenarios'

export interface OptimizedScenario {
  scenario: ScriptScenario
  nativeFault?: 'throw' | 'malformed'
  bindingCoverage?: 'batched' | 'scoped-slots' | 'eager' | 'none'
}

/** 保留两套已验证语料的完整选项；组合优化必须同时满足脚本与模板清单边界。 */
export async function optimizedScenarios(): Promise<OptimizedScenario[]> {
  return [
    ...(await scriptScenarios()).map(scenario => ({ scenario })),
    ...(await compileScenarios()).map(({ nativeFault, ...scenario }) => ({
      scenario: { ...scenario, id: `binding-${scenario.id}`, kind: 'sfc' as const },
      nativeFault,
      bindingCoverage: scenario.id === 'scoped-slots'
        ? 'scoped-slots' as const
        : scenario.id === 'jsx'
          ? 'eager' as const
          : ['static-template', 'invalid-template'].includes(scenario.id)
              ? 'none' as const
              : 'batched' as const,
    })),
  ]
}
