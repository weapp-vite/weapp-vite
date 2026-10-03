import type { AnalyzeSubpackagesResult, ModuleSourceType } from '../../analyze/subpackages/types'
import type { AnalyzeComparison, AnalyzeSizeChange } from './types'

type SizeEntry = Omit<AnalyzeSizeChange, 'change' | 'currentBytes' | 'previousBytes' | 'deltaBytes' | 'advice'> & { bytes: number | null }

function createModuleComparisonKey(source: string, sourceType: ModuleSourceType) {
  const origin = sourceType === 'node_modules' || sourceType === 'workspace' ? 'dependency' : sourceType
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

function createChangeAdvice(category: string, change: AnalyzeSizeChange['change']) {
  if (change === 'unmeasured') {
    return '缺少体积测量，不能判断增长或缩小。'
  }
  if (change === 'removed' || change === 'decreased') {
    return '确认体积减少符合预期，检查受影响页面与依赖边界。'
  }
  if (category === '第三方依赖') {
    return '检查依赖边界或公共入口。'
  }
  if (category === 'WeVu / runtime') {
    return '排查组件和 API 引用边界。'
  }
  if (category === '样式资源') {
    return '检查样式复用和生成范围。'
  }
  return change === 'added' ? '确认分包归属和懒加载边界。' : '对比新增引用和共享模块。'
}

function createSizeMaps(result: Pick<AnalyzeSubpackagesResult, 'packages'>) {
  const packages = new Map<string, SizeEntry>()
  const files = new Map<string, SizeEntry>()
  const moduleIds = new Map<string, SizeEntry>()
  let totalBytes = 0
  let unmeasuredFiles = 0

  for (const pkg of result.packages) {
    let packageBytes = 0
    let packageUnmeasuredFiles = 0
    for (const file of pkg.files) {
      const bytes = file.size ?? null
      if (bytes === null) {
        packageUnmeasuredFiles += 1
      }
      else {
        packageBytes += bytes
      }
      const fileKey = `file:${pkg.id}\0${file.file}`
      files.set(fileKey, {
        key: fileKey,
        label: file.file,
        bytes,
        packageId: pkg.id,
        packageLabel: pkg.label,
        file: file.file,
        category: classifyIncrementCategory(file.source ?? file.file),
      })
      for (const mod of file.modules ?? []) {
        const moduleBytes = mod.bytes ?? mod.originalBytes ?? null
        const existing = moduleIds.get(mod.id)
        if (existing) {
          existing.bytes = existing.bytes === null || moduleBytes === null ? null : Math.max(existing.bytes, moduleBytes)
          continue
        }
        const queryIndex = mod.source.indexOf('?')
        moduleIds.set(mod.id, {
          key: `module:${createModuleComparisonKey(mod.source, mod.sourceType)}`,
          label: mod.source,
          bytes: moduleBytes,
          moduleId: mod.id,
          sourceType: mod.sourceType,
          packageId: pkg.id,
          packageLabel: pkg.label,
          file: file.file,
          category: classifyIncrementCategory(queryIndex === -1 ? mod.source : mod.source.slice(0, queryIndex), mod.sourceType),
        })
      }
    }
    totalBytes += packageBytes
    unmeasuredFiles += packageUnmeasuredFiles
    const key = `package:${pkg.id}`
    packages.set(key, { key, label: pkg.label, bytes: packageUnmeasuredFiles > 0 ? null : packageBytes, packageId: pkg.id, packageLabel: pkg.label })
  }

  const modules = new Map<string, SizeEntry>()
  for (const mod of moduleIds.values()) {
    const existing = modules.get(mod.key)
    if (!existing) {
      modules.set(mod.key, mod)
    }
    else if (existing.bytes === null || mod.bytes === null) {
      existing.bytes = null
    }
    else if (existing.bytes < mod.bytes) {
      modules.set(mod.key, mod)
    }
  }
  return { packages, files, modules, totalBytes: unmeasuredFiles > 0 ? null : totalBytes, unmeasuredFiles }
}

function compareSizeMaps(current: Map<string, SizeEntry>, previous: Map<string, SizeEntry>): AnalyzeSizeChange[] {
  const changes: AnalyzeSizeChange[] = []
  const append = (entry: SizeEntry, currentBytes: number | null, previousBytes: number | null, change: AnalyzeSizeChange['change']) => {
    changes.push({
      key: entry.key,
      label: entry.label,
      packageId: entry.packageId,
      packageLabel: entry.packageLabel,
      file: entry.file,
      moduleId: entry.moduleId,
      sourceType: entry.sourceType,
      category: entry.category,
      change,
      currentBytes,
      previousBytes,
      deltaBytes: currentBytes === null || previousBytes === null ? null : currentBytes - previousBytes,
      advice: entry.category ? createChangeAdvice(entry.category, change) : undefined,
    })
  }
  for (const [key, entry] of current) {
    const old = previous.get(key)
    if (!old) {
      append(entry, entry.bytes, 0, 'added')
    }
    else if (entry.bytes === null || old.bytes === null) {
      append(entry, entry.bytes, old.bytes, 'unmeasured')
    }
    else if (entry.bytes !== old.bytes) {
      append(entry, entry.bytes, old.bytes, entry.bytes > old.bytes ? 'increased' : 'decreased')
    }
  }
  for (const [key, entry] of previous) {
    if (!current.has(key)) {
      append(entry, 0, entry.bytes, 'removed')
    }
  }
  return changes.sort((a, b) => (b.deltaBytes ?? -Infinity) - (a.deltaBytes ?? -Infinity) || a.key.localeCompare(b.key))
}

/** 比较两个真实快照；模块仅按已记录的 chunk 贡献归并，缺失测量不视为零。 */
export function createAnalyzeComparison(
  current: Pick<AnalyzeSubpackagesResult, 'packages'>,
  previous: Pick<AnalyzeSubpackagesResult, 'packages'>,
): AnalyzeComparison {
  const currentMaps = createSizeMaps(current)
  const previousMaps = createSizeMaps(previous)
  return {
    currentBytes: currentMaps.totalBytes,
    previousBytes: previousMaps.totalBytes,
    deltaBytes: currentMaps.totalBytes === null || previousMaps.totalBytes === null ? null : currentMaps.totalBytes - previousMaps.totalBytes,
    currentUnmeasuredFiles: currentMaps.unmeasuredFiles,
    previousUnmeasuredFiles: previousMaps.unmeasuredFiles,
    packages: compareSizeMaps(currentMaps.packages, previousMaps.packages),
    files: compareSizeMaps(currentMaps.files, previousMaps.files),
    modules: compareSizeMaps(currentMaps.modules, previousMaps.modules),
  }
}
