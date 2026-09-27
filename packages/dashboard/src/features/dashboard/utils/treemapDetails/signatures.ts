import type { TreemapNodeMeta } from '../../types'
import type { TreemapDetailContext, TreemapDetailReport } from './context'
import type { TreemapImportIndex } from './references'
import { createTreemapAssetNodeId, createTreemapFileNodeId, createTreemapModuleNodeId, createTreemapPackageNodeId } from '../treemap'
import { getDetailFileMeta } from './context'
import { createTreemapDetailSections } from './references'

type SemanticRow = Array<string | number | undefined>

const emptyImports: TreemapImportIndex = { outgoing: new Map(), incoming: new Map() }

function serializeRows(rows: SemanticRow[]) {
  return rows.map(row => JSON.stringify(row)).sort().join('\n')
}

function createChildrenSignature(report: TreemapDetailReport, meta: TreemapNodeMeta | null) {
  const rows: SemanticRow[] = []
  if (!meta) {
    for (const pkg of report.packages.values()) {
      if (!pkg.files.length) {
        continue
      }
      let bytes = 0
      let missing = 0
      for (const file of pkg.files) {
        if (file.size === undefined) {
          missing++
        }
        else {
          bytes += file.size
        }
      }
      rows.push([createTreemapPackageNodeId(pkg.id), pkg.label, bytes, missing])
    }
  }
  else if (meta.kind === 'package') {
    const pkg = report.packages.get(meta.packageId)
    if (pkg) {
      for (const file of pkg.files) {
        rows.push([createTreemapFileNodeId(pkg.id, file.file), file.file, pkg.label, file.type, file.size])
      }
    }
  }
  else if (meta.kind === 'file') {
    const location = report.files.get(meta.nodeId)
    if (location) {
      const { pkg, file } = location
      if (file.type === 'chunk') {
        for (const module of file.modules ?? []) {
          rows.push([createTreemapModuleNodeId(pkg.id, file.file, module.id), module.source, pkg.label, module.sourceType, module.bytes])
        }
      }
      else if (file.source) {
        rows.push([createTreemapAssetNodeId(pkg.id, file.file), file.source, pkg.label, file.size])
      }
    }
  }
  return serializeRows(rows)
}

/**
 * 只序列化当前分组对应的完整报告行，排除筛选、着色、排序及格式化体积。
 * 包行保留精确已知字节和缺失数量；位置与引用复用现有解析规则，并保留导航目标。
 * 引用索引按需读取，不为包、模块或资源选择构建无关的引用图。
 */
export function createTreemapDetailSignatures(
  report: TreemapDetailReport,
  meta: TreemapNodeMeta | null,
  getImports: () => TreemapImportIndex,
): Map<string, string> {
  const signatures = new Map<string, string>()
  if (!meta || meta.kind === 'package' || meta.kind === 'file') {
    signatures.set('children', createChildrenSignature(report, meta))
    if (!meta || meta.kind === 'package') {
      return signatures
    }
  }

  // 不接收图表树：引用行的“筛选外”描述在这里保持恒定，不参与筛选状态比较。
  const context: TreemapDetailContext = { ...report, tree: new Map() }
  let selected = meta
  let imports = emptyImports
  if (meta.kind === 'file') {
    const location = report.files.get(meta.nodeId)
    if (location?.file.type !== 'chunk') {
      return signatures
    }
    selected = getDetailFileMeta(context, location)
    imports = getImports()
  }
  for (const section of createTreemapDetailSections(context, imports, [], selected)) {
    if (section.id !== 'children') {
      signatures.set(section.id, serializeRows(section.rows.map(row => [row.id, row.path, row.description, row.bytes, row.meta?.nodeId])))
    }
  }
  return signatures
}
