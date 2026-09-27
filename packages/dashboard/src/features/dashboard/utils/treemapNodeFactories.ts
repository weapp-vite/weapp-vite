import type { AnalyzeSubpackagesResult, TreemapNode } from '../types'
import {
  createTreemapAssetNodeId,
  createTreemapFileNodeId,
  createTreemapModuleNodeId,
  createTreemapPackageNodeId,
  formatTreemapNodeLabel,
} from './treemap'

export function createModuleTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  moduleUsageCount: Map<string, number>,
  module: NonNullable<AnalyzeSubpackagesResult['packages'][number]['files'][number]['modules']>[number],
): TreemapNode {
  const nodeId = createTreemapModuleNodeId(packageId, fileName, module.id)
  const value = Math.max(module.bytes ?? module.originalBytes ?? 1, 1)
  const usageCount = moduleUsageCount.get(module.id) ?? 1
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
      source: module.source,
      sourceType: module.sourceType,
      bytes: module.bytes,
      originalBytes: module.originalBytes,
      packageCount: usageCount,
    },
  }
}

export function createAssetTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
): TreemapNode {
  const nodeId = createTreemapAssetNodeId(packageId, fileName)
  const value = Math.max(file.size ?? 1, 1)
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
  }
}

export function createFileTreemapNode(
  packageLabel: string,
  packageId: string,
  packageLabelMap: Map<string, string>,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  children: TreemapNode[],
  value: number,
): TreemapNode {
  const nodeId = createTreemapFileNodeId(packageId, file.file)
  const fileValue = Math.max(value, 1)
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
    children: children.length > 0 ? children : undefined,
  }
}

export function createPackageTreemapNode(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  totalBytes: number,
  fileNodes: TreemapNode[],
): TreemapNode {
  const nodeId = createTreemapPackageNodeId(pkg.id)
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
      totalBytes: pkg.files.every(file => file.size !== undefined && Number.isFinite(file.size) && file.size >= 0)
        ? totalBytes
        : undefined,
    },
    children: fileNodes,
  }
}

export function sumTreemapNodeValues(nodes: TreemapNode[]) {
  return nodes.reduce((sum, node) => sum + node.value, 0)
}
