import type { AnalyzeBudgetCheckItem } from 'weapp-vite/dashboard/analyze'
import type { AnalyzeSubpackagesResult, ModuleInFile } from '../../types'
import type { DiagnosticArtifact, DiagnosticEvidenceInput, DiagnosticSource } from './types'
import { createAnalyzeBudgetCheck, createAnalyzeComparison, createDuplicateModuleInsights } from 'weapp-vite/dashboard/analyze'
import { duplicateMeasurement, measuredBytes } from '../analyzeDataModules'
import { createLargestFiles } from '../analyzeDataPackages'
import { createFileKey } from '../analyzeDataShared'
import { formatModuleIdentifier } from '../format'
import { createTreemapModuleNodeId } from '../treemap'

export interface EvidenceTarget {
  budget?: AnalyzeBudgetCheckItem
  moduleId?: string
  packageId?: string
  file?: string
  label: string
}

export function deltaBytes(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : current - previous
}

export function resolveTarget(input: DiagnosticEvidenceInput): EvidenceTarget {
  const { action, result } = input
  if (action.kind === 'budget') {
    const budget = createAnalyzeBudgetCheck(result).find(item => item.id === action.warning?.id && item.scope === action.warning.scope)
    return { budget, label: budget?.label ?? '预算目标不可用' }
  }
  if (action.kind === 'duplicate') {
    const module = result.modules.find(item => action.key === `duplicate:${item.id}`)
    return { moduleId: module?.id, label: module ? `跨包重复 · ${formatModuleIdentifier(module.source)}` : '重复模块不可用' }
  }
  const increment = input.incrementAttribution.find(item => action.key === `increment:${item.key}`)
  const file = action.file && action.key === `increment:file:${action.file.packageId}:${action.file.file}` ? action.file : undefined
  return {
    moduleId: increment?.moduleId,
    packageId: increment?.packageId ?? file?.packageId,
    file: increment?.file ?? file?.file,
    label: increment ? `${increment.moduleId === undefined ? '产物增长' : '模块增长'} · ${increment.label}` : file ? `产物增长 · ${file.file}` : '增长目标不可用',
  }
}

export function collectArtifacts(result: AnalyzeSubpackagesResult, previous: AnalyzeSubpackagesResult | null, target: EvidenceTarget): DiagnosticArtifact[] {
  const runtimeFiles = target.budget?.scope === 'runtime' ? new Set(target.budget.files) : null
  const placements = new Map(result.modules.find(module => module.id === target.moduleId)?.packages.map(pkg => [pkg.packageId, new Set(pkg.files)]))
  const sizes = new Map<string, number | null>()
  const previousSizes = new Map<string, number | null>()
  for (const pkg of previous?.packages ?? []) {
    for (const file of pkg.files) {
      previousSizes.set(createFileKey(pkg.id, file.file), measuredBytes(file.size))
    }
  }
  const packages = result.packages.map(pkg => ({
    ...pkg,
    files: pkg.files.filter((file) => {
      if (target.budget) {
        return target.budget.scope === 'total' || (runtimeFiles ? runtimeFiles.has(file.file) : pkg.id === target.budget.id)
      }
      if (target.moduleId !== undefined) {
        return placements.get(pkg.id)?.has(file.file) || file.modules?.some(module => module.id === target.moduleId)
      }
      return pkg.id === target.packageId && file.file === target.file
    }),
  })).filter(pkg => pkg.files.length > 0)
  for (const pkg of packages) {
    for (const file of pkg.files) {
      sizes.set(createFileKey(pkg.id, file.file), measuredBytes(file.size))
    }
  }
  return createLargestFiles({ ...result, packages }, new Map()).map((entry): DiagnosticArtifact => {
    const key = createFileKey(entry.packageId, entry.file)
    const bytes = sizes.get(key) ?? null
    const previousBytes = previous ? (previousSizes.has(key) ? previousSizes.get(key)! : 0) : null
    const delta = deltaBytes(bytes, previousBytes)
    return { entry: { ...entry, sizeDeltaBytes: delta ?? undefined }, bytes, previousBytes, deltaBytes: delta }
  }).sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1) || a.entry.packageId.localeCompare(b.entry.packageId) || a.entry.file.localeCompare(b.entry.file))
}

/** 保留每个真实包／产物位置；来源路径不做展示用缩写，避免打开错误目标。 */
export function collectSources(result: AnalyzeSubpackagesResult, artifacts: DiagnosticArtifact[], moduleId?: string): DiagnosticSource[] {
  const sources = new Map<string, DiagnosticSource>()
  const usages = new Map(result.modules.map(module => [module.id, module]))
  const artifactMap = new Map(artifacts.map(artifact => [createFileKey(artifact.entry.packageId, artifact.entry.file), artifact.entry]))
  const append = (entry: DiagnosticArtifact['entry'], module: ModuleInFile, readable: boolean) => {
    if (moduleId !== undefined && module.id !== moduleId) {
      return
    }
    const id = createTreemapModuleNodeId(entry.packageId, entry.file, module.id)
    if (sources.has(id)) {
      return
    }
    const bytes = measuredBytes(module.bytes ?? module.originalBytes)
    sources.set(id, {
      id,
      bytes,
      readable,
      meta: {
        kind: 'module',
        nodeId: id,
        packageId: entry.packageId,
        packageLabel: entry.packageLabel,
        fileName: entry.file,
        source: module.source,
        sourceType: module.sourceType,
        bytes: bytes ?? undefined,
        originalBytes: measuredBytes(module.originalBytes) ?? undefined,
        packageCount: usages.get(module.id)?.packages.length ?? 1,
      },
    })
  }
  for (const { entry } of artifacts) {
    for (const module of entry.modules ?? []) {
      append(entry, module, module.sourceType !== 'node_modules' && Boolean(module.source))
    }
  }
  for (const module of result.modules) {
    if (moduleId !== undefined && module.id !== moduleId) {
      continue
    }
    for (const pkg of module.packages) {
      for (const file of pkg.files) {
        const entry = artifactMap.get(createFileKey(pkg.packageId, file))
        if (entry) {
          append(entry, module, false)
        }
      }
    }
  }
  return [...sources.values()].sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1) || a.id.localeCompare(b.id))
}

export function budgetPreviousBytes(previous: AnalyzeSubpackagesResult | null, budget: AnalyzeBudgetCheckItem): number | null {
  if (!previous) {
    return null
  }
  const old = createAnalyzeBudgetCheck(previous).find(item => item.id === budget.id && item.scope === budget.scope)
  if (old) {
    return old.status === 'unknown' ? null : measuredBytes(old.currentBytes)
  }
  if (budget.scope === 'runtime') {
    const runtime = previous.artifacts?.runtime
    return runtime && runtime.unknownFiles.length === 0 ? measuredBytes(runtime.upperBoundBytes) : null
  }
  if (budget.scope === 'total') {
    return null
  }
  // 旧快照可能没有此包的预算（例如 virtual 包），但测量仍可由共享比较获得。
  return createAnalyzeComparison(previous, { packages: [] }).packages.find(pkg => pkg.packageId === budget.id)?.currentBytes ?? (previous.packages.some(pkg => pkg.id === budget.id) ? null : 0)
}

export function moduleMeasurement(input: DiagnosticEvidenceInput, moduleId: string) {
  const comparison = createAnalyzeComparison(input.result, input.previous ?? { packages: [] })
  let item = comparison.modules.find(module => module.moduleId === moduleId)
  if (!item && input.previous) {
    const current = createAnalyzeComparison(input.result, { packages: [] }).modules.find(module => module.moduleId === moduleId)
    if (current) {
      item = { ...current, previousBytes: current.currentBytes, deltaBytes: current.currentBytes === null ? null : 0 }
    }
  }
  const currentBytes = measuredBytes(item?.currentBytes)
  const previousBytes = input.previous ? measuredBytes(item?.previousBytes) : null
  return { currentBytes, previousBytes, deltaBytes: deltaBytes(currentBytes, previousBytes) }
}

export function duplicatePreviousBytes(previous: AnalyzeSubpackagesResult | null, moduleId: string): number | null {
  if (!previous) {
    return null
  }
  const estimate = createDuplicateModuleInsights(previous).find(item => item.id === moduleId)?.estimatedSavingBytes
  return duplicateMeasurement(previous, moduleId, estimate)
}
