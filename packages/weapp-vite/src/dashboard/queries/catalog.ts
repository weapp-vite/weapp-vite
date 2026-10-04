import type { DashboardArtifactsPage, DashboardModulesPage, DashboardPackagesPage } from './schema'
import type { ReadDashboardQuerySnapshot } from './shared'
import { createAnalyzeBudgetCheck, createDuplicateModuleInsights } from '../analyze'
import { createModuleByteMap } from '../analyze/moduleBytes'
import { artifactsQuerySchema, modulesQuerySchema, packagesQuerySchema } from './schema'
import { compareText, createModulePlacementIndex, matchesQuery, ordered, paginate, selectAnalyzeReport, summarizeBudget } from './shared'

export function queryAnalyzePackages(read: ReadDashboardQuerySnapshot, input: unknown): DashboardPackagesPage {
  const request = packagesQuerySchema.parse(input)
  const { result, context } = selectAnalyzeReport(read, request)
  const budgets = new Map(createAnalyzeBudgetCheck(result).filter(item => item.scope !== 'total' && item.scope !== 'runtime').map(item => [item.id, item]))
  const placements = createModulePlacementIndex(result)
  const items: DashboardPackagesPage['items'] = []
  for (const pkg of result.packages) {
    const budget = summarizeBudget(budgets.get(pkg.id))
    if ((request.type !== undefined && pkg.type !== request.type)
      || (request.budgetStatus !== undefined && budget?.status !== request.budgetStatus)
      || !matchesQuery(request.query, pkg.id, pkg.label)) {
      continue
    }
    let bytes = 0
    let unmeasuredFiles = 0
    for (const file of pkg.files) {
      bytes += file.size ?? 0
      unmeasuredFiles += file.size === undefined ? 1 : 0
    }
    items.push({ id: pkg.id, label: pkg.label, type: pkg.type, bytes, fileCount: pkg.files.length, moduleCount: placements.get(pkg.id)?.moduleIds.size ?? 0, unmeasuredFiles, budget })
  }
  items.sort((a, b) => {
    const primary = request.sortBy === 'name'
      ? compareText(a.label, b.label)
      : request.sortBy === 'budgetRatio'
        ? (a.budget?.ratio ?? -1) - (b.budget?.ratio ?? -1)
        : a.bytes - b.bytes
    return ordered(primary, request.order) || compareText(a.id, b.id)
  })
  return { ...context, ...paginate(items, request) }
}

export function queryAnalyzeArtifacts(read: ReadDashboardQuerySnapshot, input: unknown): DashboardArtifactsPage {
  const request = artifactsQuerySchema.parse(input)
  const { result, context } = selectAnalyzeReport(read, request)
  const items: DashboardArtifactsPage['items'] = []
  const placements = createModulePlacementIndex(result)
  for (const pkg of result.packages) {
    if (request.packageId !== undefined && pkg.id !== request.packageId) {
      continue
    }
    const moduleFiles = placements.get(pkg.id)?.files
    for (const file of pkg.files) {
      if ((request.type !== undefined && file.type !== request.type)
        || (request.moduleId !== undefined && !moduleFiles?.get(file.file)?.has(request.moduleId))
        || !matchesQuery(request.query, file.file, file.source)) {
        continue
      }
      items.push({
        packageId: pkg.id,
        packageType: pkg.type,
        file: file.file,
        type: file.type,
        from: file.from,
        size: file.size ?? null,
        gzipSize: file.gzipSize,
        brotliSize: file.brotliSize,
        isEntry: file.isEntry,
        moduleCount: moduleFiles?.get(file.file)?.size ?? 0,
        source: file.source,
        sourceType: file.sourceType,
      })
    }
  }
  items.sort((a, b) => {
    const primary = request.sortBy === 'path' ? compareText(a.file, b.file) : (a.size ?? -1) - (b.size ?? -1)
    return ordered(primary, request.order) || compareText(a.packageId, b.packageId) || compareText(a.file, b.file)
  })
  return { ...context, ...paginate(items, request) }
}

export function queryAnalyzeModules(read: ReadDashboardQuerySnapshot, input: unknown): DashboardModulesPage {
  const request = modulesQuerySchema.parse(input)
  const { result, context } = selectAnalyzeReport(read, request)
  const bytes = createModuleByteMap(result)
  const duplicates = new Map(createDuplicateModuleInsights(result).map(item => [item.id, item]))
  const independentPackages = new Set(result.packages.filter(pkg => pkg.type === 'independent').map(pkg => pkg.id))
  const items: DashboardModulesPage['items'] = []
  for (const module of result.modules) {
    const duplicate = duplicates.get(module.id)
    if ((request.sourceType !== undefined && module.sourceType !== request.sourceType)
      || (request.duplicateOnly && !duplicate)
      || !matchesQuery(request.query, module.id, module.source)
      || ((request.packageId !== undefined || request.artifact !== undefined) && !module.packages.some(pkg =>
        (request.packageId === undefined || pkg.packageId === request.packageId)
        && (request.artifact === undefined || pkg.files.includes(request.artifact)),
      ))) {
      continue
    }
    items.push({
      id: module.id,
      source: module.source,
      sourceType: module.sourceType,
      bytes: bytes.get(module.id) ?? 0,
      packageCount: module.packages.length,
      fileCount: module.packages.reduce((total, pkg) => total + pkg.files.length, 0),
      estimatedSavingBytes: duplicate?.estimatedSavingBytes ?? 0,
      hasIndependentPackage: duplicate?.hasIndependentPackage ?? module.packages.some(pkg => independentPackages.has(pkg.packageId)),
      advice: duplicate?.advice,
    })
  }
  items.sort((a, b) => {
    const primary = request.sortBy === 'source' ? compareText(a.source, b.source) : a[request.sortBy] - b[request.sortBy]
    return ordered(primary, request.order) || compareText(a.id, b.id)
  })
  return { ...context, ...paginate(items, request) }
}
