import type { TreemapNode, TreemapNodeMeta } from '../../types'
import type { TreemapDetailContext, TreemapDetailReport, TreemapDetailRow, TreemapDetailSection, TreemapFileLocation } from './context'
import { normalizeChunkPath, resolveChunkImport } from '../analyzeChunkGraph'
import { createTreemapFileNodeId } from '../treemap'
import { createDetailRow, createFileLocationRow, findDetailFile, findDetailModule, sortDetailRows } from './context'

interface FileImport {
  source: TreemapFileLocation
  target?: TreemapFileLocation
  path: string
  kind: 'static' | 'dynamic'
  unresolved?: string
}

export function createTreemapImportIndex(context: TreemapDetailReport) {
  const chunks = new Map<string, TreemapFileLocation[]>()
  for (const location of context.files.values()) {
    if (location.file.type !== 'chunk') {
      continue
    }
    const path = normalizeChunkPath(location.file.file)
    const existing = chunks.get(path)
    if (existing) {
      existing.push(location)
    }
    else {
      chunks.set(path, [location])
    }
  }
  const outgoing = new Map<string, FileImport[]>()
  const incoming = new Map<string, FileImport[]>()
  for (const location of context.files.values()) {
    if (location.file.type !== 'chunk') {
      continue
    }
    const imports: FileImport[] = []
    for (const kind of ['static', 'dynamic'] as const) {
      const paths = kind === 'static' ? location.file.imports : location.file.dynamicImports
      for (const path of new Set(paths)) {
        const external = /^(?:[a-z][\w+.-]*:|\/\/)/i.test(path)
        const candidates = external ? [] : chunks.get(resolveChunkImport(location.file.file, path)) ?? []
        const local = candidates.filter(candidate => candidate.pkg.id === location.pkg.id)
        const matches = local.length ? local : candidates
        const target = matches.length === 1 ? matches[0] : undefined
        const entry: FileImport = {
          source: location,
          target,
          path,
          kind,
          unresolved: target ? undefined : matches.length > 1 ? '同名产物存在歧义，无法定位' : '外部或未输出的产物',
        }
        imports.push(entry)
        if (target) {
          const targetId = createTreemapFileNodeId(target.pkg.id, target.file.file)
          const existing = incoming.get(targetId)
          if (existing) {
            existing.push(entry)
          }
          else {
            incoming.set(targetId, [entry])
          }
        }
      }
    }
    outgoing.set(createTreemapFileNodeId(location.pkg.id, location.file.file), imports)
  }
  return { outgoing, incoming }
}

export interface TreemapImportIndex {
  outgoing: Map<string, FileImport[]>
  incoming: Map<string, FileImport[]>
}

function createModuleLocations(context: TreemapDetailContext, meta: TreemapNodeMeta): TreemapDetailRow[] {
  const module = findDetailModule(context, meta)
  if (!module) {
    return []
  }
  const locations = new Map<string, TreemapDetailRow>()
  const containingFile = findDetailFile(context, meta)
  if (containingFile) {
    const row = createFileLocationRow(context, containingFile)
    locations.set(row.id, row)
  }
  for (const placement of context.modules.get(module.id)?.packages ?? []) {
    for (const fileName of placement.files) {
      const nodeId = createTreemapFileNodeId(placement.packageId, fileName)
      const location = context.files.get(nodeId)
      locations.set(nodeId, location
        ? createFileLocationRow(context, location)
        : {
            id: nodeId,
            path: fileName,
            description: `${context.packages.get(placement.packageId)?.label ?? placement.packageId} · 报告未包含产物详情`,
            size: '未知（未记录）',
          })
    }
  }
  return sortDetailRows([...locations.values()])
}

function createImportSections(context: TreemapDetailContext, imports: TreemapImportIndex, meta: TreemapNodeMeta): TreemapDetailSection[] {
  return (['outgoing', 'incoming'] as const).flatMap(direction => (['static', 'dynamic'] as const).map((kind) => {
    const entries = imports[direction].get(meta.nodeId) ?? []
    const rows = entries.filter(entry => entry.kind === kind).map((entry): TreemapDetailRow => {
      const location = direction === 'incoming' ? entry.source : entry.target
      const id = `${direction}\u0000${kind}\u0000${entry.source.pkg.id}\u0000${entry.source.file.file}\u0000${entry.path}`
      if (!location) {
        return { id, path: entry.path, description: entry.unresolved ?? '', size: '体积未知' }
      }
      const row = createFileLocationRow(context, location)
      return { ...row, id, description: `${row.description} · import: ${entry.path}` }
    })
    return {
      title: `${direction === 'incoming' ? '被引用 · ' : '引用 · '}${kind === 'static' ? '静态 import' : '动态 import'}`,
      empty: direction === 'incoming' ? '报告中没有可定位到此产物的引用。' : '报告未记录此类引用。',
      rows: sortDetailRows(rows),
    }
  }))
}

export function createTreemapDetailSections(
  context: TreemapDetailContext,
  imports: TreemapImportIndex,
  nodes: TreemapNode[],
  meta: TreemapNodeMeta | null,
): TreemapDetailSection[] {
  if (!meta || meta.kind === 'package' || meta.kind === 'file') {
    const children = meta ? context.tree.get(meta.nodeId)?.children ?? [] : nodes
    const sections: TreemapDetailSection[] = [{
      title: !meta ? '包' : meta.kind === 'package' ? '产物文件' : '模块与资源',
      empty: !meta || meta.kind === 'package'
        ? '当前筛选下没有可浏览的节点。请调整图表筛选。'
        : '当前筛选下无子节点，或报告未记录模块 / 资源来源。',
      rows: sortDetailRows(children.map(node => createDetailRow(context, node.meta))),
    }]
    if (meta?.kind === 'file' && meta.type === 'chunk') {
      sections.push(...createImportSections(context, imports, meta))
    }
    return sections
  }
  if (meta.kind === 'module') {
    return [{ title: '所在产物 · 跨包位置', empty: '报告未记录此模块的产物位置。', rows: createModuleLocations(context, meta) }]
  }
  const location = findDetailFile(context, meta)
  return [{ title: '所在产物', empty: '报告未包含此资源的产物详情。', rows: location ? [createFileLocationRow(context, location)] : [] }]
}
