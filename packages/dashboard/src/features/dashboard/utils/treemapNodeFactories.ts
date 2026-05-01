import type { AnalyzeSubpackagesResult, ResolvedTheme, TreemapNode } from '../types'
import {
  createTreemapAssetNodeId,
  createTreemapFileNodeId,
  createTreemapModuleNodeId,
  createTreemapPackageNodeId,
} from './treemap'
import {
  createRiskNodeStyle,
  createShareRiskScore,
  normalizeTreemapRiskScore,
} from './treemapRisk'

export function createModuleTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  fileBytes: number,
  moduleUsageCount: Map<string, number>,
  module: NonNullable<AnalyzeSubpackagesResult['packages'][number]['files'][number]['modules']>[number],
  theme: ResolvedTheme,
): TreemapNode {
  const nodeId = createTreemapModuleNodeId(packageId, fileName, module.id)
  const value = Math.max(module.bytes ?? module.originalBytes ?? 1, 1)
  const usageCount = moduleUsageCount.get(module.id) ?? 1
  const riskScore = Math.max(
    createShareRiskScore(value, fileBytes),
    usageCount > 1 ? 0.62 : 0,
    module.sourceType === 'node_modules' ? 0.52 : 0,
  )
  const normalizedRiskScore = normalizeTreemapRiskScore(riskScore, module.id, module.source, fileName)
  return {
    id: nodeId,
    name: module.source,
    value,
    meta: {
      kind: 'module',
      nodeId,
      packageId,
      packageLabel,
      fileName,
      source: module.source,
      sourceType: module.sourceType,
      bytes: module.bytes,
      originalBytes: module.originalBytes,
      packageCount: usageCount,
    },
    ...createRiskNodeStyle(normalizedRiskScore, theme),
  }
}

export function createAssetTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  packageBytes: number,
  theme: ResolvedTheme,
): TreemapNode {
  const nodeId = createTreemapAssetNodeId(packageId, fileName)
  const value = Math.max(file.size ?? 1, 1)
  const riskScore = normalizeTreemapRiskScore(createShareRiskScore(value, packageBytes), file.file, file.source, packageId, packageLabel)
  return {
    id: nodeId,
    name: file.source ?? fileName,
    value,
    meta: {
      kind: 'asset',
      nodeId,
      packageId,
      packageLabel,
      fileName,
      source: file.source ?? fileName,
      bytes: file.size,
    },
    ...createRiskNodeStyle(riskScore, theme),
  }
}

export function createFileTreemapNode(
  packageLabel: string,
  packageId: string,
  packageLabelMap: Map<string, string>,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  children: TreemapNode[],
  value: number,
  packageBytes: number,
  packageRiskScore: number,
  theme: ResolvedTheme,
): TreemapNode {
  const nodeId = createTreemapFileNodeId(packageId, file.file)
  const fileValue = Math.max(value, 1)
  const riskScore = normalizeTreemapRiskScore(
    Math.max(createShareRiskScore(fileValue, packageBytes), packageRiskScore * 0.72),
    file.file,
    file.source,
    packageId,
    packageLabel,
  )
  return {
    id: nodeId,
    name: file.file,
    value: fileValue,
    meta: {
      kind: 'file',
      nodeId,
      packageId,
      packageLabel: packageLabelMap.get(packageId) ?? packageLabel,
      fileName: file.file,
      from: file.from,
      childCount: children.length,
      type: file.type,
      bytes: file.size,
    },
    ...createRiskNodeStyle(riskScore, theme),
    children: children.length > 0 ? children : undefined,
  }
}

export function createPackageTreemapNode(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  totalBytes: number,
  fileNodes: TreemapNode[],
  riskScore: number,
  theme: ResolvedTheme,
): TreemapNode {
  const nodeId = createTreemapPackageNodeId(pkg.id)
  const normalizedRiskScore = normalizeTreemapRiskScore(riskScore, pkg.id, pkg.label)

  return {
    id: nodeId,
    name: pkg.label,
    value: Math.max(totalBytes, 1),
    meta: {
      kind: 'package',
      nodeId,
      packageId: pkg.id,
      packageLabel: pkg.label,
      packageType: pkg.type,
      fileCount: pkg.files.length,
      totalBytes,
    },
    ...createRiskNodeStyle(normalizedRiskScore, theme),
    children: fileNodes,
  }
}

export function sumTreemapNodeValues(nodes: TreemapNode[]) {
  return nodes.reduce((sum, node) => sum + node.value, 0)
}
