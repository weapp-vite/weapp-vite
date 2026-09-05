import type { AnalyzeSubpackagesResult, IncrementAttributionEntry, IncrementAttributionSummary, ModuleSourceType } from '../types'
import type { FileComparisonMaps } from './analyzeDataShared'
import { createFileKey, createModulePlacementMap, getFileSize } from './analyzeDataShared'
import { formatModuleIdentifier } from './format'

function classifyIncrementCategory(source: string, sourceType?: ModuleSourceType) {
  if (source.includes('wevu') || source.includes('@weapp-vite/dashboard')) {
    return 'WeVu / runtime'
  }
  if (sourceType === 'node_modules' || source.includes('node_modules')) {
    return '第三方依赖'
  }
  if (sourceType === 'workspace') {
    return '工作区包'
  }
  if (sourceType === 'plugin') {
    return '插件生成'
  }
  if (source.endsWith('.wxss') || source.endsWith('.css') || source.endsWith('.scss')) {
    return '样式资源'
  }
  if (source.endsWith('.wxml') || source.endsWith('.json')) {
    return '页面结构'
  }
  return '业务源码'
}

function createIncrementAdvice(category: string, isNew: boolean) {
  if (category === '第三方依赖') {
    return '检查依赖边界或公共入口。'
  }
  if (category === 'WeVu / runtime') {
    return '排查组件和 API 引用边界。'
  }
  if (category === '样式资源') {
    return '检查样式复用和生成范围。'
  }
  return isNew ? '确认分包归属和懒加载边界。' : '对比新增引用和共享模块。'
}

interface CanonicalModuleGrowth {
  id: string
  label: string
  sourceType: ModuleSourceType
  currentBytes: number
  packageId?: string
  packageLabel: string
  file?: string
}

function createModuleComparisonKey(source: string, sourceType: ModuleSourceType) {
  const origin = sourceType === 'node_modules' || sourceType === 'workspace'
    ? 'dependency'
    : sourceType
  const queryIndex = source.indexOf('?')
  let canonicalSource = (queryIndex === -1 ? source : source.slice(0, queryIndex))
    .replaceAll('\\', '/')
    .replace(/^\0/, '')
  if (origin === 'dependency') {
    const nodeModulesMarker = '/node_modules/'
    const nodeModulesIndex = canonicalSource.lastIndexOf(nodeModulesMarker)
    if (nodeModulesIndex >= 0) {
      canonicalSource = canonicalSource.slice(nodeModulesIndex + nodeModulesMarker.length)
    }
    else if (canonicalSource.startsWith('node_modules/')) {
      canonicalSource = canonicalSource.slice('node_modules/'.length)
    }
    else if (sourceType === 'workspace') {
      const workspaceMatch = canonicalSource.match(/(?:^|\/)packages-runtime\/(wevu\/.*)$/)
        ?? canonicalSource.match(/(?:^|\/)(@[^/]+\/[^/]+\/dist\/.*)$/)
      canonicalSource = workspaceMatch?.[1] ?? canonicalSource
    }
  }
  return `${origin}\0${canonicalSource}`
}

export function createIncrementAttribution(options: {
  result: AnalyzeSubpackagesResult | null
  previousResult?: AnalyzeSubpackagesResult | null
  previousMaps: FileComparisonMaps
  moduleInfoMap: Map<string, { bytes: number, originalBytes: number, sourceType: ModuleSourceType }>
}): IncrementAttributionEntry[] {
  if (!options.result || !options.previousResult) {
    return []
  }

  const items: IncrementAttributionEntry[] = []
  const currentModulePlacementMap = createModulePlacementMap(options.result)
  for (const pkg of options.result.packages) {
    for (const file of pkg.files) {
      const currentBytes = getFileSize(file)
      const previousBytes = options.previousMaps.fileBytes.get(createFileKey(pkg.id, file.file)) ?? 0
      const deltaBytes = currentBytes - previousBytes
      if (deltaBytes <= 0) {
        continue
      }
      const category = classifyIncrementCategory(file.source ?? file.file)
      items.push({
        key: `file:${pkg.id}:${file.file}`,
        label: file.file,
        category,
        packageId: pkg.id,
        packageLabel: pkg.label,
        file: file.file,
        currentBytes,
        previousBytes,
        deltaBytes,
        advice: createIncrementAdvice(category, previousBytes === 0),
      })
    }
  }

  const previousModuleBytes = new Map<string, number>()
  for (const [id, mod] of options.previousMaps.moduleBytes) {
    const key = createModuleComparisonKey(mod.source ?? id, mod.sourceType)
    previousModuleBytes.set(key, Math.max(previousModuleBytes.get(key) ?? 0, mod.bytes))
  }

  const currentModules = new Map<string, CanonicalModuleGrowth>()
  for (const [id, mod] of options.moduleInfoMap) {
    const placement = currentModulePlacementMap.get(id)
    const sourceType = placement?.sourceType ?? mod.sourceType
    const label = formatModuleIdentifier(placement?.source ?? id)
    const key = createModuleComparisonKey(placement?.source ?? id, sourceType)
    const existing = currentModules.get(key)
    if (existing && existing.currentBytes >= mod.bytes) {
      continue
    }
    currentModules.set(key, {
      id,
      label,
      sourceType,
      currentBytes: mod.bytes,
      packageId: placement?.packageId,
      packageLabel: placement?.packageLabel ?? '',
      file: placement?.file,
    })
  }

  for (const [key, mod] of currentModules) {
    const previousBytes = previousModuleBytes.get(key) ?? 0
    const deltaBytes = mod.currentBytes - previousBytes
    if (deltaBytes <= 0) {
      continue
    }
    const category = classifyIncrementCategory(mod.label, mod.sourceType)
    items.push({
      key: `module:${mod.id}`,
      label: mod.label,
      category,
      packageId: mod.packageId,
      packageLabel: mod.packageLabel,
      file: mod.file,
      moduleId: mod.id,
      sourceType: mod.sourceType,
      currentBytes: mod.currentBytes,
      previousBytes,
      deltaBytes,
      advice: createIncrementAdvice(category, previousBytes === 0),
    })
  }

  return items.sort((a, b) =>
    b.deltaBytes - a.deltaBytes
    || a.category.localeCompare(b.category)
    || a.label.localeCompare(b.label),
  )
}

export function createIncrementSummary(items: IncrementAttributionEntry[]): IncrementAttributionSummary[] {
  const map = new Map<string, IncrementAttributionSummary>()
  for (const item of items) {
    const entry = map.get(item.category) ?? {
      category: item.category,
      count: 0,
      deltaBytes: 0,
    }
    entry.count += 1
    entry.deltaBytes += item.deltaBytes
    map.set(item.category, entry)
  }
  return [...map.values()]
    .sort((a, b) => b.deltaBytes - a.deltaBytes || b.count - a.count || a.category.localeCompare(b.category))
}
