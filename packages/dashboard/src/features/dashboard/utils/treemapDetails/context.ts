import type {
  AnalyzeSubpackagesResult,
  ModuleInFile,
  ModuleUsage,
  PackageFileEntry,
  PackageReport,
  TreemapFileNodeMeta,
  TreemapNode,
  TreemapNodeMeta,
} from '../../types'
import { formatBytes, formatPackageType, formatSourceType } from '../format'
import { createTreemapFileNodeId, createTreemapModuleNodeId } from '../treemap'

export interface TreemapFileLocation {
  pkg: PackageReport
  file: PackageFileEntry
}

export interface TreemapDetailRow {
  id: string
  path: string
  description: string
  size: string
  bytes?: number
  meta?: TreemapNodeMeta
}

export interface TreemapDetailSection {
  title: string
  empty: string
  rows: TreemapDetailRow[]
}

export interface TreemapDetailReport {
  packages: Map<string, PackageReport>
  files: Map<string, TreemapFileLocation>
  modules: Map<string, ModuleUsage>
  modulesByNodeId: Map<string, ModuleInFile>
}

export interface TreemapDetailContext extends TreemapDetailReport {
  tree: Map<string, TreemapNode>
}

export function createTreemapDetailReport(result: AnalyzeSubpackagesResult): TreemapDetailReport {
  const packages = new Map(result.packages.map(pkg => [pkg.id, pkg]))
  const files = new Map<string, TreemapFileLocation>()
  const modulesByNodeId = new Map<string, ModuleInFile>()
  for (const pkg of result.packages) {
    for (const file of pkg.files) {
      files.set(createTreemapFileNodeId(pkg.id, file.file), { pkg, file })
      for (const module of file.modules ?? []) {
        modulesByNodeId.set(createTreemapModuleNodeId(pkg.id, file.file, module.id), module)
      }
    }
  }
  return { packages, files, modules: new Map(result.modules.map(module => [module.id, module])), modulesByNodeId }
}

export function createTreemapDetailContext(report: TreemapDetailReport, nodes: TreemapNode[]): TreemapDetailContext {
  const tree = new Map<string, TreemapNode>()
  function visit(items: TreemapNode[]) {
    for (const node of items) {
      tree.set(node.meta.nodeId, node)
      if (node.children) {
        visit(node.children)
      }
    }
  }
  visit(nodes)
  return { ...report, tree }
}

export function findDetailFile(context: TreemapDetailContext, meta: TreemapNodeMeta) {
  return meta.kind === 'package' ? undefined : context.files.get(createTreemapFileNodeId(meta.packageId, meta.fileName))
}

export function findDetailModule(context: TreemapDetailContext, meta: TreemapNodeMeta): ModuleInFile | undefined {
  if (meta.kind !== 'module') {
    return undefined
  }
  return context.modulesByNodeId.get(meta.nodeId)
}

export function getDetailFileMeta(context: TreemapDetailContext, { pkg, file }: TreemapFileLocation): TreemapFileNodeMeta {
  const nodeId = createTreemapFileNodeId(pkg.id, file.file)
  const current = context.tree.get(nodeId)?.meta
  if (current?.kind === 'file') {
    return current
  }
  return {
    kind: 'file',
    nodeId,
    packageId: pkg.id,
    packageLabel: pkg.label,
    fileName: file.file,
    from: file.from,
    type: file.type,
    bytes: file.size,
    childCount: file.type === 'chunk' ? file.modules?.length ?? 0 : Number(Boolean(file.source)),
  }
}

export function formatDetailBytes(bytes?: number) {
  return bytes === undefined ? '未知（未记录）' : bytes === 0 ? '0 B' : formatBytes(bytes)
}

function getPackageSize(pkg: PackageReport | undefined) {
  if (!pkg) {
    return { text: '未知（未记录）', bytes: undefined }
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
  return {
    bytes: missing ? undefined : bytes,
    text: missing ? `已知 ${formatDetailBytes(bytes)} · ${missing} 个产物体积未知` : formatDetailBytes(bytes),
  }
}

export function getDetailSize(context: TreemapDetailContext, meta: TreemapNodeMeta) {
  if (meta.kind === 'package') {
    return getPackageSize(context.packages.get(meta.packageId))
  }
  const bytes = meta.kind === 'module' ? findDetailModule(context, meta)?.bytes : findDetailFile(context, meta)?.file.size
  return { bytes, text: formatDetailBytes(bytes) }
}

export function getDetailPath(context: TreemapDetailContext, meta: TreemapNodeMeta) {
  if (meta.kind === 'package') {
    return meta.packageId
  }
  if (meta.kind === 'module') {
    return findDetailModule(context, meta)?.source || meta.source
  }
  if (meta.kind === 'asset') {
    return findDetailFile(context, meta)?.file.source || meta.fileName
  }
  return meta.fileName
}

export function getDetailKind(meta: TreemapNodeMeta) {
  if (meta.kind === 'package') {
    return formatPackageType(meta.packageType)
  }
  if (meta.kind === 'module') {
    return `模块 · ${formatSourceType(meta.sourceType)}`
  }
  return meta.kind === 'asset' ? '资源来源' : meta.type === 'chunk' ? '代码产物' : '资源产物'
}

export function createDetailRow(context: TreemapDetailContext, meta: TreemapNodeMeta): TreemapDetailRow {
  const size = getDetailSize(context, meta)
  return {
    id: meta.nodeId,
    path: getDetailPath(context, meta),
    description: meta.kind === 'package' ? meta.packageLabel : `${getDetailKind(meta)} · ${meta.packageLabel}`,
    size: `${size.text}${meta.kind === 'module' && size.bytes !== undefined ? ' · 模块贡献' : ''}`,
    bytes: size.bytes,
    meta,
  }
}

export function createFileLocationRow(context: TreemapDetailContext, location: TreemapFileLocation): TreemapDetailRow {
  const row = createDetailRow(context, getDetailFileMeta(context, location))
  if (!context.tree.has(row.id)) {
    row.description += ' · 当前筛选外'
  }
  return row
}

export function sortDetailRows(rows: TreemapDetailRow[]) {
  return rows.sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1) || a.path.localeCompare(b.path) || a.id.localeCompare(b.id))
}

export function getDetailSourceState(context: TreemapDetailContext, meta: TreemapNodeMeta) {
  const file = findDetailFile(context, meta)?.file
  const module = findDetailModule(context, meta)
  if (meta.kind === 'package') {
    return { available: false, message: '选择产物或模块后查看源码与产物。' }
  }
  if (meta.kind === 'module') {
    const supported = module && ['src', 'workspace', 'plugin'].includes(module.sourceType)
    return {
      available: Boolean(supported && module.source),
      message: module?.sourceType === 'node_modules'
        ? '依赖模块暂无可读取的源码入口。'
        : '分析报告未记录此模块的可读取源码。',
    }
  }
  return {
    available: Boolean(file?.source || (meta.kind === 'file' && file?.modules?.some(module =>
      ['src', 'workspace', 'plugin'].includes(module.sourceType) && module.source,
    ))),
    message: '分析报告未记录此产物的可读取源码。',
  }
}
