import type { DashboardInvestigationTarget, DashboardObjectMeasurements } from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult, ModuleInFile, PackageFileEntry, PackageReport } from '../../types'

export interface InspectionNode {
  key: string
  target: DashboardInvestigationTarget
  label: string
  packageLabel: string
  artifactKey: string | null
  sourcePath: string | null
  sourceType: string | null
  placementOnly: boolean
  measurements: DashboardObjectMeasurements
  moduleCount: number
}

export interface InspectionIndex {
  packages: InspectionNode[]
  artifacts: InspectionNode[]
  modules: InspectionNode[]
  nodes: Map<string, InspectionNode>
}

/** 用完整身份生成键，避免包名、路径中分隔符造成碰撞。 */
export function inspectionTargetKey(target: DashboardInvestigationTarget) {
  return JSON.stringify(target.kind === 'package'
    ? [target.kind, target.packageId]
    : target.kind === 'artifact'
      ? [target.kind, target.packageId, target.file]
      : [target.kind, target.packageId, target.file, target.moduleId])
}

/** 未测量值始终为空；零是有效测量。 */
export function measuredBytes(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function packageBytes(pkg: PackageReport, field: 'size' | 'gzipSize' | 'brotliSize') {
  let total = 0
  for (const file of pkg.files) {
    const value = measuredBytes(file[field])
    if (value === null) {
      return null
    }
    total += value
  }
  return total
}

function measurements(label: string, file?: PackageFileEntry, module?: ModuleInFile): DashboardObjectMeasurements {
  return {
    label,
    rawBytes: module ? null : measuredBytes(file?.size),
    gzipBytes: module ? null : measuredBytes(file?.gzipSize),
    brotliBytes: module ? null : measuredBytes(file?.brotliSize),
    attributedBytes: measuredBytes(module?.bytes),
    sourceBytes: measuredBytes(module?.originalBytes),
  }
}

/** 只把报告中的文件归属和模块落点建成关系，不推断 import 边。 */
export function createInspectionIndex(result: AnalyzeSubpackagesResult): InspectionIndex {
  const index: InspectionIndex = { packages: [], artifacts: [], modules: [], nodes: new Map() }
  const packageLabels = new Map(result.packages.map(pkg => [pkg.id, pkg.label]))
  for (const pkg of result.packages) {
    const target: DashboardInvestigationTarget = { kind: 'package', packageId: pkg.id }
    const packageNode: InspectionNode = {
      key: inspectionTargetKey(target),
      target,
      label: pkg.label,
      packageLabel: pkg.label,
      artifactKey: null,
      sourcePath: null,
      sourceType: null,
      placementOnly: false,
      moduleCount: 0,
      measurements: {
        label: pkg.label,
        rawBytes: packageBytes(pkg, 'size'),
        gzipBytes: packageBytes(pkg, 'gzipSize'),
        brotliBytes: packageBytes(pkg, 'brotliSize'),
        attributedBytes: null,
        sourceBytes: null,
      },
    }
    index.packages.push(packageNode)
    index.nodes.set(packageNode.key, packageNode)
    for (const file of pkg.files) {
      const target: DashboardInvestigationTarget = { kind: 'artifact', packageId: pkg.id, file: file.file }
      const key = inspectionTargetKey(target)
      const artifact: InspectionNode = {
        key,
        target,
        label: file.file,
        packageLabel: pkg.label,
        artifactKey: key,
        sourcePath: file.source?.split('?')[0] || null,
        sourceType: file.type,
        placementOnly: false,
        measurements: measurements(file.file, file),
        moduleCount: 0,
      }
      index.artifacts.push(artifact)
      index.nodes.set(key, artifact)
      for (const module of file.modules ?? []) {
        const target: DashboardInvestigationTarget = { kind: 'module', packageId: pkg.id, file: file.file, moduleId: module.id }
        const node: InspectionNode = {
          key: inspectionTargetKey(target),
          target,
          label: module.source || module.id,
          packageLabel: pkg.label,
          artifactKey: key,
          sourcePath: module.sourceType !== 'node_modules' ? module.source.split('?')[0] || null : null,
          sourceType: module.sourceType,
          placementOnly: false,
          measurements: measurements(module.source || module.id, undefined, module),
          moduleCount: 0,
        }
        if (!index.nodes.has(node.key)) {
          index.modules.push(node)
          index.nodes.set(node.key, node)
          artifact.moduleCount += 1
          packageNode.moduleCount += 1
        }
      }
    }
  }
  for (const module of result.modules) {
    for (const placement of module.packages) {
      for (const file of placement.files) {
        const target: DashboardInvestigationTarget = { kind: 'module', packageId: placement.packageId, file, moduleId: module.id }
        const key = inspectionTargetKey(target)
        if (index.nodes.has(key)) {
          continue
        }
        const artifactKey = inspectionTargetKey({ kind: 'artifact', packageId: placement.packageId, file })
        const node: InspectionNode = {
          key,
          target,
          label: module.source || module.id,
          packageLabel: packageLabels.get(placement.packageId) ?? placement.packageId,
          artifactKey,
          sourcePath: null,
          sourceType: module.sourceType,
          placementOnly: true,
          measurements: measurements(module.source || module.id),
          moduleCount: 0,
        }
        index.modules.push(node)
        index.nodes.set(key, node)
        const artifact = index.nodes.get(artifactKey)
        if (artifact) {
          artifact.moduleCount += 1
        }
        const pkg = index.nodes.get(inspectionTargetKey({ kind: 'package', packageId: placement.packageId }))
        if (pkg) {
          pkg.moduleCount += 1
        }
      }
    }
  }
  return index
}

/** 查询和范围只来自显式筛选，绝不消费选中对象。 */
export function filterInspectionNodes(nodes: InspectionNode[], query: string, packageId: string) {
  const text = query.trim().toLocaleLowerCase()
  return nodes.filter(node => (!packageId || node.target.packageId === packageId)
    && (!text || `${node.label}\n${node.target.kind === 'module' ? node.target.moduleId : ''}\n${node.target.packageId}\n${node.target.kind !== 'package' ? node.target.file : ''}`.toLocaleLowerCase().includes(text)))
}

/** 失效目标仅派生展示默认值，不回写第二份选择状态。 */
export function resolveInspectionTarget(index: InspectionIndex, target: DashboardInvestigationTarget | null) {
  return (target ? index.nodes.get(inspectionTargetKey(target)) : undefined) ?? index.artifacts[0] ?? null
}

/** 只定位筛选结果中的真实关联链，不补回被隐藏的对象。 */
export function resolveInspectionRelationTargets(
  index: Pick<InspectionIndex, 'packages' | 'artifacts' | 'modules'>,
  selected: InspectionNode | null,
): InspectionNode[] {
  if (!selected) {
    return []
  }
  const pkg = index.packages.find(node => node.target.packageId === selected.target.packageId)
  const artifact = index.artifacts.find(node => selected.target.kind === 'package'
    ? node.target.packageId === selected.target.packageId
    : node.key === selected.artifactKey)
  const module = index.modules.find(node => selected.target.kind === 'module'
    ? node.key === selected.key
    : artifact !== undefined && node.artifactKey === artifact.key)
  return [pkg, artifact, module].filter((node): node is InspectionNode => node !== undefined)
}
