import type { AnalyzeModuleCategory } from '../../packages/weapp-vite/src/analyze/subpackages/artifacts'
import type { RuntimeSizeTarget, RuntimeSizeTier, RuntimeSizeTierReport } from '../runtime-size'
import path from 'node:path'
import { classifyOwnedModule, createModuleOwnerResolver } from '../../packages/weapp-vite/src/analyze/subpackages/artifacts/owner'
import { runtimeModuleFacet } from './facets'
import { resolveRuntimeImportChain } from './modules'

export interface RuntimeTierAttribution {
  generatedEntry: string
  comparison?: { tier: RuntimeSizeTier['id'], bytesDelta: number }
  attribution: 'esbuild-metafile-bytes-in-output'
  categoryBytes: Partial<Record<AnalyzeModuleCategory, number>>
  facetBytes: Record<string, number>
  unattributedBytes: number
  modules: Array<{ path: string, bytesInOutput: number, bytesDelta: number, category: AnalyzeModuleCategory, facet: string, importChain: string[] }>
  removedModules: string[]
}

const comparisonTier: Partial<Record<RuntimeSizeTier['id'], RuntimeSizeTier['id']>> = {
  'minimal-app': 'reactivity-core',
  'typical-page': 'minimal-app',
  'complex-component': 'typical-page',
  'public-app': 'minimal-app',
  'public-page': 'public-app',
  'full-provider': 'complex-component',
}

/** 复用分析器的包归属，把能力输入、保留模块、引用链和阶梯差值保存在同一报告中。 */
export function createRuntimeTierAttribution(
  root: string,
  target: RuntimeSizeTarget,
  tier: RuntimeSizeTierReport,
  tiers: RuntimeSizeTierReport[],
  generatedEntry: string,
): RuntimeTierAttribution {
  const baselineId = comparisonTier[tier.id]
  const baseline = baselineId ? tiers.find(candidate => candidate.id === baselineId) : undefined
  if (baselineId && !baseline) {
    throw new Error(`Missing comparison tier: ${target.id}/${baselineId}`)
  }
  const previous = new Map(baseline?.production.retainedModules.modules.map(module => [module.path, module.bytesInOutput]))
  const retained = tier.production.retainedModules
  const resolveOwner = createModuleOwnerResolver()
  const categoryBytes: RuntimeTierAttribution['categoryBytes'] = {}
  const facetBytes: Record<string, number> = {}
  const modules = retained.modules.filter(module => module.bytesInOutput > 0).map((module) => {
    const owner = resolveOwner(path.resolve(root, module.path))
    const category = classifyOwnedModule(owner, module.path === retained.entry)
    const facet = runtimeModuleFacet(module.path, owner, category)
    categoryBytes[category] = (categoryBytes[category] ?? 0) + module.bytesInOutput
    facetBytes[facet] = (facetBytes[facet] ?? 0) + module.bytesInOutput
    return {
      path: module.path,
      bytesInOutput: module.bytesInOutput,
      bytesDelta: module.bytesInOutput - (previous.get(module.path) ?? 0),
      category,
      facet,
      importChain: resolveRuntimeImportChain(retained, module.path),
    }
  })
  const attributedBytes = modules.reduce((sum, module) => sum + module.bytesInOutput, 0)
  if (attributedBytes > tier.production.bytes) {
    throw new Error(`Module attribution exceeds output bytes: ${target.id}/${tier.id}`)
  }
  const live = new Set(modules.map(module => module.path))
  return {
    generatedEntry,
    ...(baseline ? { comparison: { tier: baseline.id, bytesDelta: tier.production.bytes - baseline.production.bytes } } : {}),
    attribution: 'esbuild-metafile-bytes-in-output',
    categoryBytes,
    facetBytes,
    unattributedBytes: tier.production.bytes - attributedBytes,
    modules,
    removedModules: [...previous].filter(([modulePath, bytes]) => bytes > 0 && !live.has(modulePath)).map(([modulePath]) => modulePath).sort(),
  }
}
