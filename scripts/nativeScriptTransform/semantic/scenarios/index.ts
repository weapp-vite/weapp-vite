import type { SemanticCoverage, SemanticScenario, SemanticTools } from '../types'
import { createRetailScenario, retailCoverage } from './retail'
import { createWevuScenario, wevuCoverage } from './wevu'

/** 这些是已知 workspace 依赖入口，父 runner 扩展 owner 的 src/dist；并非 node_modules 完整字节闭包。 */
export const semanticDependencyFiles = [
  'packages-runtime/wevu/package.json',
  'packages-runtime/wevu/src/reactivity/ref.ts',
  'packages-runtime/wevu/src/reactivity/computed.ts',
  'packages-runtime/wevu/src/runtime/template.ts',
  'packages-runtime/wevu/src/runtime/register/inline.ts',
  '@weapp-core/constants/package.json',
  '@weapp-core/constants/dist/index.js',
  '@weapp-core/shared/package.json',
  '@weapp-core/shared/dist/platforms/runtime/index.js',
  'packages-runtime/web-apis/package.json',
  'packages-runtime/web-apis/dist/abort.mjs',
]

export function semanticCoverage(id: string): SemanticCoverage {
  const coverage = id === 'sfc-wevu' ? wevuCoverage : id === 'sfc-retail' ? retailCoverage : undefined
  if (!coverage) {
    throw new Error(`Unsupported semantic scenario ${id}`)
  }
  return structuredClone(coverage)
}

export function createSemanticScenario(id: string, tools: SemanticTools): SemanticScenario {
  const scenario = id === 'sfc-wevu' ? createWevuScenario(tools) : id === 'sfc-retail' ? createRetailScenario(tools) : undefined
  if (!scenario) {
    throw new Error(`Unsupported semantic scenario ${id}`)
  }
  return { ...scenario, coverage: semanticCoverage(id), dependencyFiles: [...semanticDependencyFiles] }
}
