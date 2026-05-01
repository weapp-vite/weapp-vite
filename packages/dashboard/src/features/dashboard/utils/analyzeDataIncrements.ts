import type { AnalyzeSubpackagesResult, IncrementAttributionEntry, IncrementAttributionSummary, ModuleSourceType } from '../types'
import type { FileComparisonMaps } from './analyzeDataShared'
import { createFileKey, createModulePlacementMap, getFileSize } from './analyzeDataShared'

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

  for (const [id, mod] of options.moduleInfoMap) {
    const previousBytes = options.previousMaps.moduleBytes.get(id)?.bytes ?? 0
    const deltaBytes = mod.bytes - previousBytes
    if (deltaBytes <= 0) {
      continue
    }
    const previousModule = options.previousMaps.moduleBytes.get(id)
    const currentModule = currentModulePlacementMap.get(id)
    const label = currentModule?.source ?? previousModule?.source ?? id
    const category = classifyIncrementCategory(label, currentModule?.sourceType ?? mod.sourceType)
    items.push({
      key: `module:${id}`,
      label,
      category,
      packageId: currentModule?.packageId ?? previousModule?.packageId,
      packageLabel: currentModule?.packageLabel ?? previousModule?.packageLabel ?? '',
      file: currentModule?.file ?? previousModule?.file,
      moduleId: id,
      sourceType: currentModule?.sourceType ?? mod.sourceType,
      currentBytes: mod.bytes,
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
