import type { PackageReport } from '../types'
import type { AnalyzeArtifact, AnalyzeArtifactAnalysis, AnalyzeModuleOwner } from './types'
import { isRuntimeCategory } from './category'
import { classifyOwnedModule, createModuleOwnerResolver } from './owner'

export type * from './types'

export function createArtifactAnalysis(
  packages: PackageReport[],
  resolveOwner: (id: string) => AnalyzeModuleOwner | undefined = createModuleOwnerResolver(),
): AnalyzeArtifactAnalysis {
  const files = new Map<string, AnalyzeArtifact>()
  const moduleCopies = new Map<string, number[]>()
  for (const pkg of packages) {
    for (const file of pkg.files) {
      if (files.has(file.file)) {
        throw new Error(`产物重复归属：${file.file}`)
      }
      if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size < 0) {
        throw new Error(`产物缺少有效字节数：${file.file}`)
      }
      const retained = (file.modules ?? []).filter(module => module.bytes !== 0)
      const length = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
      const totalLength = retained.reduce((sum, module) => sum + length(module.bytes), 0)
      const scale = Math.max(totalLength, file.moduleRenderedLength ?? 0, file.size)
      const modules = retained.map((module) => {
        const owner = resolveOwner(module.id)
        const category = classifyOwnedModule(owner, module.sourceType === 'src' || module.sourceType === 'plugin')
        const estimatedBytes = scale > 0 ? file.size! * length(module.bytes) / scale : 0
        const copies = moduleCopies.get(module.id) ?? []
        copies.push(estimatedBytes)
        moduleCopies.set(module.id, copies)
        return { source: module.source, package: owner, category, renderedLength: module.bytes, estimatedBytes }
      })
      const runtime = modules.filter(module => isRuntimeCategory(module.category))
      const roles = new Set<AnalyzeArtifact['role']>(modules.map(module =>
        isRuntimeCategory(module.category) ? 'runtime' : module.category === 'application' ? 'application' : module.category === 'dependency' ? 'dependency' : 'unknown',
      ))
      const isAsset = file.type === 'asset' && !file.modules && !/\.[cm]?js$/i.test(file.file)
      const role = isAsset ? 'asset' : roles.size > 1 ? 'mixed' : [...roles][0] ?? 'unknown'
      files.set(file.file, {
        file: file.file,
        packageId: pkg.id,
        origin: file.from,
        type: file.type,
        bytes: file.size,
        sha256: file.sha256,
        role,
        classification: isAsset ? 'asset' : modules.length ? 'module-ownership' : 'unavailable',
        estimation: 'rendered-length-proportional',
        modules,
        runtimeEstimatedBytes: runtime.reduce((sum, module) => sum + module.estimatedBytes, 0),
        unattributedBytes: Math.max(0, file.size - modules.reduce((sum, module) => sum + module.estimatedBytes, 0)),
      })
    }
  }
  const artifacts = [...files.values()].sort((a, b) => a.file.localeCompare(b.file))
  if (artifacts.length === 0) {
    throw new Error('未生成可分析产物，不能把缺失输出计为零字节。')
  }
  return {
    files: artifacts,
    totalBytes: artifacts.reduce((sum, file) => sum + file.bytes, 0),
    duplicateEstimatedBytes: [...moduleCopies.values()].reduce((sum, copies) => sum + copies.reduce((a, b) => a + b, 0) - Math.max(...copies), 0),
    runtime: {
      estimatedBytes: artifacts.reduce((sum, file) => sum + file.runtimeEstimatedBytes, 0),
      upperBoundBytes: artifacts.filter(file => file.modules.some(module => isRuntimeCategory(module.category))).reduce((sum, file) => sum + file.bytes, 0),
      unknownFiles: artifacts.filter(file => file.role === 'unknown' || file.modules.some(module => module.category === 'unknown')).map(file => file.file),
    },
  }
}
