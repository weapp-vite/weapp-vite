import type { AnalyzeSubpackagesResult, PackageFileEntry } from '../types'

export type AnalyzeChunkGraphEdgeKind = 'contains' | 'dynamic-import' | 'static-import'
export type AnalyzeChunkGraphNodeKind = 'chunk' | 'package'

export interface AnalyzeChunkGraphNode {
  fileCount?: number
  id: string
  isEntry?: boolean
  kind: AnalyzeChunkGraphNodeKind
  label: string
  moduleCount?: number
  packageId: string
  packageLabel: string
  size: number
}

export interface AnalyzeChunkGraphEdge {
  id: string
  kind: AnalyzeChunkGraphEdgeKind
  source: string
  target: string
}

export interface AnalyzeChunkGraphModel {
  dynamicImportCount: number
  edges: AnalyzeChunkGraphEdge[]
  nodes: AnalyzeChunkGraphNode[]
  staticImportCount: number
  unresolvedImportCount: number
}

function normalizeChunkPath(value: string) {
  return value
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .split(/[?#]/, 1)[0] ?? ''
}

function resolveChunkImport(fromFile: string, importedFile: string) {
  const normalizedImport = normalizeChunkPath(importedFile)
  if (!importedFile.startsWith('.')) {
    return normalizedImport
  }

  const segments = [...normalizeChunkPath(fromFile).split('/').slice(0, -1), ...normalizedImport.split('/')]
  const resolved: string[] = []
  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      resolved.pop()
      continue
    }
    resolved.push(segment)
  }
  return resolved.join('/')
}

function createChunkNode(packageId: string, packageLabel: string, file: PackageFileEntry): AnalyzeChunkGraphNode {
  return {
    id: `chunk:${file.file}`,
    kind: 'chunk',
    label: file.file,
    packageId,
    packageLabel,
    size: file.size ?? 0,
    isEntry: file.isEntry,
    moduleCount: file.modules?.length ?? 0,
  }
}

export function createAnalyzeChunkGraph(result: AnalyzeSubpackagesResult): AnalyzeChunkGraphModel {
  const nodes: AnalyzeChunkGraphNode[] = []
  const edges = new Map<string, AnalyzeChunkGraphEdge>()
  const chunkNodeIdByFile = new Map<string, string>()
  const chunks: Array<{ file: PackageFileEntry, node: AnalyzeChunkGraphNode }> = []

  for (const packageReport of result.packages) {
    const packageChunks = packageReport.files.filter(file => file.type === 'chunk')
    const packageNode: AnalyzeChunkGraphNode = {
      id: `package:${packageReport.id}`,
      kind: 'package',
      label: packageReport.label,
      packageId: packageReport.id,
      packageLabel: packageReport.label,
      size: packageReport.files.reduce((total, file) => total + (file.size ?? 0), 0),
      fileCount: packageReport.files.length,
    }
    nodes.push(packageNode)

    for (const file of packageChunks) {
      const node = createChunkNode(packageReport.id, packageReport.label, file)
      nodes.push(node)
      chunks.push({ file, node })
      chunkNodeIdByFile.set(normalizeChunkPath(file.file), node.id)
      const edge: AnalyzeChunkGraphEdge = {
        id: `${packageNode.id}->${node.id}:contains`,
        kind: 'contains',
        source: packageNode.id,
        target: node.id,
      }
      edges.set(edge.id, edge)
    }
  }

  let unresolvedImportCount = 0
  let staticImportCount = 0
  let dynamicImportCount = 0
  for (const { file, node } of chunks) {
    const imports: Array<{ file: string, kind: AnalyzeChunkGraphEdgeKind }> = [
      ...(file.imports ?? []).map(importedFile => ({ file: importedFile, kind: 'static-import' as const })),
      ...(file.dynamicImports ?? []).map(importedFile => ({ file: importedFile, kind: 'dynamic-import' as const })),
    ]
    for (const imported of imports) {
      const target = chunkNodeIdByFile.get(resolveChunkImport(file.file, imported.file))
      if (!target) {
        unresolvedImportCount += 1
        continue
      }
      const edge: AnalyzeChunkGraphEdge = {
        id: `${node.id}->${target}:${imported.kind}`,
        kind: imported.kind,
        source: node.id,
        target,
      }
      if (!edges.has(edge.id)) {
        edges.set(edge.id, edge)
        if (imported.kind === 'dynamic-import') {
          dynamicImportCount += 1
        }
        else {
          staticImportCount += 1
        }
      }
    }
  }

  return {
    dynamicImportCount,
    edges: [...edges.values()],
    nodes,
    staticImportCount,
    unresolvedImportCount,
  }
}

export interface AnalyzeChunkGraphView {
  edges: AnalyzeChunkGraphEdge[]
  nodes: AnalyzeChunkGraphNode[]
  truncatedEdgeCount: number
  truncatedNodeCount: number
}

export function createAnalyzeChunkGraphView(
  graph: AnalyzeChunkGraphModel,
  options: {
    maxEdges: number
    maxNodes: number
    packageId: string
    query: string
  },
): AnalyzeChunkGraphView {
  const packageNodes = graph.nodes.filter(node => node.kind === 'package')
  const chunkNodes = graph.nodes.filter(node => node.kind === 'chunk')
  const normalizedQuery = options.query.trim().toLowerCase()
  const matchingChunks = chunkNodes
    .filter(node => options.packageId === 'all' || node.packageId === options.packageId)
    .filter(node => !normalizedQuery || node.label.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => right.size - left.size)
  const matchingIds = new Set(matchingChunks.map(node => node.id))
  const neighborIds = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.kind === 'contains') {
      continue
    }
    const sourceMatches = matchingIds.has(edge.source)
    const targetMatches = matchingIds.has(edge.target)
    if (sourceMatches && !targetMatches) {
      neighborIds.add(edge.target)
    }
    else if (targetMatches && !sourceMatches) {
      neighborIds.add(edge.source)
    }
  }

  const neighborChunks = chunkNodes
    .filter(node => neighborIds.has(node.id))
    .sort((left, right) => right.size - left.size)
  const desiredChunks = [...new Map(
    [...matchingChunks, ...neighborChunks].map(node => [node.id, node]),
  ).values()]
  const chunkBudget = Math.max(0, options.maxNodes - packageNodes.length)
  const visibleChunks = desiredChunks.slice(0, chunkBudget)
  const visiblePackageIds = new Set(visibleChunks.map(node => node.packageId))
  const visiblePackages = packageNodes.filter(node => visiblePackageIds.has(node.packageId))
  const nodes = [...visiblePackages, ...visibleChunks].slice(0, options.maxNodes)
  const nodeIds = new Set(nodes.map(node => node.id))
  const desiredPackageIds = new Set(desiredChunks.map(node => node.packageId))
  const desiredNodeIds = new Set([
    ...desiredChunks.map(node => node.id),
    ...packageNodes.filter(node => desiredPackageIds.has(node.packageId)).map(node => node.id),
  ])
  const desiredEdges = graph.edges.filter(edge => desiredNodeIds.has(edge.source) && desiredNodeIds.has(edge.target))
  const candidateEdges = graph.edges
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .sort((left, right) => Number(left.kind === 'contains') - Number(right.kind === 'contains'))
  const edges = candidateEdges.slice(0, options.maxEdges)

  return {
    edges,
    nodes,
    truncatedEdgeCount: Math.max(0, desiredEdges.length - edges.length),
    truncatedNodeCount: Math.max(0, desiredNodeIds.size - nodes.length),
  }
}
