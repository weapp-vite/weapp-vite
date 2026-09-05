import type { AnalyzeSubpackagesResult, TreemapNode } from '../types'
import { formatModuleIdentifier } from './format'
import {
  createTreemapAssetNodeId,
  createTreemapFileNodeId,
  createTreemapModuleNodeId,
  createTreemapPackageNodeId,
  formatTreemapNodeLabel,
} from './treemap'
import {
  createShareRiskScore,
  createTreemapNodeStyle,
  normalizeTreemapRiskScore,
} from './treemapRisk'

export function createModuleTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  fileBytes: number,
  moduleUsageCount: Map<string, number>,
  module: NonNullable<AnalyzeSubpackagesResult['packages'][number]['files'][number]['modules']>[number],
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
    name: formatTreemapNodeLabel(module.source),
    value,
    meta: {
      kind: 'module',
      nodeId,
      packageId,
      packageLabel,
      fileName,
      source: formatModuleIdentifier(module.source),
      sourceType: module.sourceType,
      bytes: module.bytes,
      originalBytes: module.originalBytes,
      packageCount: usageCount,
    },
    ...createTreemapNodeStyle(normalizedRiskScore, packageId, 'leaf', value >= 2 * 1024),
  }
}

export function createAssetTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  packageBytes: number,
): TreemapNode {
  const nodeId = createTreemapAssetNodeId(packageId, fileName)
  const value = Math.max(file.size ?? 1, 1)
  const riskScore = normalizeTreemapRiskScore(createShareRiskScore(value, packageBytes), file.file, file.source, packageId, packageLabel)
  return {
    id: nodeId,
    name: formatTreemapNodeLabel(file.source ?? fileName),
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
    ...createTreemapNodeStyle(riskScore, packageId, 'leaf', value >= 2 * 1024),
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
    name: formatTreemapNodeLabel(file.file),
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
    ...createTreemapNodeStyle(riskScore, packageId, 'file', true, fileValue >= 4 * 1024),
    children: children.length > 0 ? children : undefined,
  }
}

export function createPackageTreemapNode(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  totalBytes: number,
  fileNodes: TreemapNode[],
  riskScore: number,
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
    ...createTreemapNodeStyle(normalizedRiskScore, pkg.id, 'package'),
    children: fileNodes,
  }
}

export function sumTreemapNodeValues(nodes: TreemapNode[]) {
  return nodes.reduce((sum, node) => sum + node.value, 0)
}
