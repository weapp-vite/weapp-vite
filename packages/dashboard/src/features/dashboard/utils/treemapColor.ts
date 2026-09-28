import type { AnalyzeSubpackagesResult, AnalyzeTreemapColorMode, ModuleInFile, TreemapLegendItem, TreemapNode } from '../types'
import type { TreemapColorStyle } from './treemapPalette'
import { createTreemapAssetNodeId, createTreemapFileNodeId, createTreemapModuleNodeId, createTreemapPackageNodeId } from './treemap'
import { createTreemapColorStyle, isWevuRuntimeReference } from './treemapPalette'

type SourceCategory = 'business' | 'npm' | 'plugin' | 'runtime' | 'asset' | 'unknown' | 'mixed'

interface TreemapColorFact {
  source: SourceCategory
  duplicated: boolean
  bytes?: number
}

interface TreemapColorIndex {
  nodes: Map<string, TreemapColorFact>
  moduleUsageCount: Map<string, number>
}

const semanticColors = {
  business: { label: '业务 / 工作区', hue: 210 },
  npm: { label: 'npm 依赖', hue: 275 },
  plugin: { label: '插件 / 生成代码', hue: 38 },
  runtime: { label: 'WeVu runtime', hue: 175 },
  asset: { label: '资源', hue: 325 },
  unknown: { label: '未知', hue: 215, saturation: 8 },
  mixed: { label: '混合来源', hue: 215, saturation: 18 },
  duplicate: { label: '跨包重复模块', hue: 12 },
  containsDuplicate: { label: '含重复模块', hue: 38 },
  unique: { label: '未发现跨包重复', hue: 215, saturation: 12 },
  growth: { label: '增大', hue: 12 },
  shrink: { label: '缩小', hue: 150 },
  unchanged: { label: '不变', hue: 215, saturation: 12 },
  added: { label: '新增', hue: 275 },
  addedUnknown: { label: '新增（体积未知）', hue: 275, saturation: 18 },
  noBaseline: { label: '无比较快照', hue: 215, saturation: 8 },
} satisfies Record<string, { label: string, hue: number, saturation?: number }>

type SemanticColor = keyof typeof semanticColors

const semanticStyles = Object.fromEntries(Object.entries(semanticColors).map(([key, definition]) => [
  key,
  createTreemapColorStyle(key, definition.hue, 'saturation' in definition ? definition.saturation : undefined),
])) as Record<SemanticColor, TreemapColorStyle>

function knownBytes(bytes: number | undefined) {
  return typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0 ? bytes : undefined
}

function moduleSource(module: ModuleInFile): SourceCategory {
  if (isWevuRuntimeReference(module.id, module.source)) {
    return 'runtime'
  }
  if (module.sourceType === 'src' || module.sourceType === 'workspace') {
    return 'business'
  }
  if (module.sourceType === 'node_modules') {
    return 'npm'
  }
  if (module.sourceType === 'plugin') {
    return 'plugin'
  }
  return 'unknown'
}

function mergeSource(current: SourceCategory | undefined, next: SourceCategory): SourceCategory {
  return current === undefined || current === next ? next : 'mixed'
}

export function createTreemapColorIndex(result: AnalyzeSubpackagesResult | null): TreemapColorIndex {
  const modulePackages = new Map<string, Set<string>>()
  for (const pkg of result?.packages ?? []) {
    for (const file of pkg.files) {
      for (const module of file.modules ?? []) {
        const packages = modulePackages.get(module.id)
        if (packages) {
          packages.add(pkg.id)
        }
        else {
          modulePackages.set(module.id, new Set([pkg.id]))
        }
      }
    }
  }
  const moduleUsageCount = new Map([...modulePackages].map(([id, packages]) => [id, packages.size]))
  const nodes = new Map<string, TreemapColorFact>()
  for (const pkg of result?.packages ?? []) {
    let packageSource: SourceCategory | undefined
    let packageDuplicated = false
    let packageBytes: number | undefined = 0
    for (const file of pkg.files) {
      let source: SourceCategory | undefined
      let duplicated = false
      for (const module of file.modules ?? []) {
        const fact: TreemapColorFact = {
          source: moduleSource(module),
          duplicated: (moduleUsageCount.get(module.id) ?? 0) > 1,
          bytes: knownBytes(module.bytes),
        }
        nodes.set(createTreemapModuleNodeId(pkg.id, file.file, module.id), fact)
        source = mergeSource(source, fact.source)
        duplicated ||= fact.duplicated
      }
      const fact: TreemapColorFact = {
        source: file.type === 'asset' ? 'asset' : source ?? 'unknown',
        duplicated,
        bytes: knownBytes(file.size),
      }
      nodes.set(createTreemapFileNodeId(pkg.id, file.file), fact)
      if (file.type === 'asset') {
        nodes.set(createTreemapAssetNodeId(pkg.id, file.file), fact)
      }
      packageSource = mergeSource(packageSource, fact.source)
      packageDuplicated ||= duplicated
      packageBytes = packageBytes !== undefined && fact.bytes !== undefined
        ? packageBytes + fact.bytes
        : undefined
    }
    nodes.set(createTreemapPackageNodeId(pkg.id), {
      source: packageSource ?? 'unknown',
      duplicated: packageDuplicated,
      bytes: packageBytes,
    })
  }
  return { nodes, moduleUsageCount }
}

export function createTreemapComparisonSizes(result: AnalyzeSubpackagesResult | null) {
  const sizes = new Map<string, number | undefined>()
  for (const pkg of result?.packages ?? []) {
    let packageBytes: number | undefined = 0
    for (const file of pkg.files) {
      const bytes = knownBytes(file.size)
      sizes.set(createTreemapFileNodeId(pkg.id, file.file), bytes)
      if (file.type === 'asset') {
        sizes.set(createTreemapAssetNodeId(pkg.id, file.file), bytes)
      }
      for (const module of file.modules ?? []) {
        sizes.set(createTreemapModuleNodeId(pkg.id, file.file, module.id), knownBytes(module.bytes))
      }
      packageBytes = packageBytes !== undefined && bytes !== undefined ? packageBytes + bytes : undefined
    }
    sizes.set(createTreemapPackageNodeId(pkg.id), packageBytes)
  }
  return sizes
}

function deltaColor(nodeId: string, bytes: number | undefined, comparison: Map<string, number | undefined> | null): {
  key: SemanticColor
  deltaBytes?: number
} {
  if (!comparison) {
    return { key: 'noBaseline' }
  }
  if (!comparison.has(nodeId)) {
    return bytes === undefined ? { key: 'addedUnknown' } : { key: 'added', deltaBytes: bytes }
  }
  const previousBytes = comparison.get(nodeId)
  if (bytes === undefined || previousBytes === undefined) {
    return { key: 'unknown' }
  }
  const deltaBytes = bytes - previousBytes
  return { key: deltaBytes > 0 ? 'growth' : deltaBytes < 0 ? 'shrink' : 'unchanged', deltaBytes }
}

export function colorTreemapNodes(options: {
  nodes: TreemapNode[]
  mode: AnalyzeTreemapColorMode
  current: TreemapColorIndex
  comparison: Map<string, number | undefined> | null
}) {
  const legend = new Map<string, TreemapLegendItem>()
  const packageStyles = new Map<string, TreemapColorStyle>()
  function project(node: TreemapNode): TreemapNode {
    const fact = options.current.nodes.get(node.id)
    let label: string
    let style: TreemapColorStyle
    let deltaBytes: number | undefined
    if (options.mode === 'package') {
      label = node.meta.packageLabel
      const packageId = node.meta.packageId
      const cached = packageStyles.get(packageId)
      style = cached ?? createTreemapColorStyle(packageId)
      if (!cached) {
        packageStyles.set(packageId, style)
      }
    }
    else {
      let key: SemanticColor
      if (options.mode === 'source') {
        key = fact?.source ?? 'unknown'
      }
      else if (options.mode === 'duplicates') {
        key = fact?.duplicated
          ? node.meta.kind === 'module' ? 'duplicate' : 'containsDuplicate'
          : 'unique'
      }
      else {
        const delta = deltaColor(node.id, fact?.bytes, options.comparison)
        key = delta.key
        deltaBytes = delta.deltaBytes
      }
      label = semanticColors[key].label
      style = semanticStyles[key]
    }
    const legendKey = `${label}\0${style.itemStyle.color}`
    if (!legend.has(legendKey)) {
      legend.set(legendKey, { label, color: style.itemStyle.color })
    }
    return {
      ...node,
      ...style,
      meta: { ...node.meta, colorLabel: label, deltaBytes },
      children: node.children?.map(project),
    }
  }
  const nodes = options.nodes.map(project)
  return { nodes, legend: [...legend.values()] }
}

export function describeTreemapColor(mode: AnalyzeTreemapColorMode, hasComparison: boolean) {
  switch (mode) {
    case 'package':
      return '颜色表示所属分包，与筛选和体积独立；同一分包保持同色。'
    case 'source':
      return '按完整当前快照中的来源分类；仅明确的 WeVu 路径标记为 runtime，插件不等同于 runtime，容器可包含混合来源。'
    case 'duplicates':
      return '按模块 ID 判断是否实际产出到多个不同分包，不按 npm 版本判断；容器“含重复模块”不代表其中所有内容重复。'
    case 'delta':
      return hasComparison
        ? '对比完整快照的同一分包 / 文件 / 模块位置，使用产物字节数；缺失体积为未知，新增单独标记。颜色不改变筛选后的面积；已删除节点不在当前图中。'
        : '无比较快照，无法判断体积变化；面积仍显示当前筛选结果。'
  }
}
