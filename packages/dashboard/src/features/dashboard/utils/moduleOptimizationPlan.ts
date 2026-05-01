import type { DuplicateModuleEntry, IncrementAttributionEntry, LargestFileEntry } from '../types'
import { formatBytes } from './format'

export type ModuleOptimizationEffort = 'low' | 'medium' | 'high'

export interface ModuleOptimizationPlanItem {
  id: string
  title: string
  detail: string
  impactBytes: number
  effort: ModuleOptimizationEffort
  priority: number
  action: string
}

export interface ModuleOptimizationPlanSummary {
  totalImpactBytes: number
  quickWinCount: number
  items: ModuleOptimizationPlanItem[]
  report: string
}

function getEffortLabel(effort: ModuleOptimizationEffort) {
  if (effort === 'high') {
    return '高'
  }
  if (effort === 'medium') {
    return '中'
  }
  return '低'
}

function createDuplicatePlanItem(module: DuplicateModuleEntry): ModuleOptimizationPlanItem {
  const effort: ModuleOptimizationEffort = module.packages.some(pkg => pkg.packageLabel.includes('independent') || pkg.packageId.includes('independent'))
    ? 'high'
    : module.packageCount > 2
      ? 'medium'
      : 'low'
  const effortPenalty = effort === 'high' ? 0.72 : effort === 'medium' ? 0.86 : 1
  return {
    id: `duplicate:${module.id}`,
    title: `收敛重复模块 ${module.source}`,
    detail: `${module.packageCount} 个包复用 · 单份 ${formatBytes(module.bytes)} · ${module.advice}`,
    impactBytes: module.estimatedSavingBytes,
    effort,
    priority: Math.round(module.estimatedSavingBytes * effortPenalty + module.packageCount * 128),
    action: effort === 'high' ? '先确认独立分包隔离要求，再评估公共入口。' : '优先抽到共享入口或调整引用边界。',
  }
}

function createIncrementPlanItem(item: IncrementAttributionEntry): ModuleOptimizationPlanItem {
  const effort: ModuleOptimizationEffort = item.category === '第三方依赖' ? 'medium' : 'low'
  const effortPenalty = effort === 'medium' ? 0.82 : 0.92
  return {
    id: `increment:${item.key}`,
    title: `复核增长来源 ${item.label}`,
    detail: `${item.category} · ${item.packageLabel} · +${formatBytes(item.deltaBytes)}`,
    impactBytes: item.deltaBytes,
    effort,
    priority: Math.round(item.deltaBytes * effortPenalty),
    action: item.advice,
  }
}

function createLargeFilePlanItem(file: LargestFileEntry): ModuleOptimizationPlanItem {
  const effort: ModuleOptimizationEffort = file.moduleCount > 12 ? 'medium' : 'low'
  return {
    id: `file:${file.packageId}:${file.file}`,
    title: `检查大文件边界 ${file.file}`,
    detail: `${file.packageLabel} · ${formatBytes(file.size)} · ${file.moduleCount} 个模块`,
    impactBytes: file.size,
    effort,
    priority: Math.round(file.size * 0.42 + file.moduleCount * 96),
    action: file.isEntry ? '确认入口依赖是否可懒加载或拆到分包。' : '检查静态资源和模块聚合边界。',
  }
}

function createPlanReport(summary: Omit<ModuleOptimizationPlanSummary, 'report'>) {
  return [
    '# dashboard 模块优化计划',
    '',
    `计划项：${summary.items.length}`,
    `估算影响：${formatBytes(summary.totalImpactBytes)}`,
    `低成本项：${summary.quickWinCount}`,
    '',
    '| 优先级 | 事项 | 影响 | 成本 | 建议 |',
    '| ---: | --- | ---: | --- | --- |',
    ...summary.items.map(item => `| ${item.priority} | ${item.title.replaceAll('|', '\\|')} | ${formatBytes(item.impactBytes)} | ${getEffortLabel(item.effort)} | ${item.action.replaceAll('|', '\\|')} |`),
    '',
  ].join('\n')
}

export function createModuleOptimizationPlanSummary(options: {
  duplicateModules: DuplicateModuleEntry[]
  incrementAttribution: IncrementAttributionEntry[]
  largestFiles: LargestFileEntry[]
}): ModuleOptimizationPlanSummary {
  const duplicateItems = options.duplicateModules
    .filter(module => module.estimatedSavingBytes > 0)
    .slice(0, 8)
    .map(createDuplicatePlanItem)
  const incrementItems = options.incrementAttribution
    .filter(item => item.deltaBytes > 0)
    .slice(0, 6)
    .map(createIncrementPlanItem)
  const duplicateFileKeys = new Set(options.duplicateModules.flatMap(module => module.packages.flatMap(pkg => pkg.files.map(file => `${pkg.packageId}:${file}`))))
  const largeFileItems = options.largestFiles
    .filter(file => file.size > 0 && !duplicateFileKeys.has(`${file.packageId}:${file.file}`))
    .slice(0, 4)
    .map(createLargeFilePlanItem)
  const items = [
    ...duplicateItems,
    ...incrementItems,
    ...largeFileItems,
  ]
    .sort((a, b) => b.priority - a.priority || b.impactBytes - a.impactBytes || a.title.localeCompare(b.title))
    .slice(0, 8)
  const summary = {
    totalImpactBytes: items.reduce((sum, item) => sum + item.impactBytes, 0),
    quickWinCount: items.filter(item => item.effort === 'low').length,
    items,
  }

  return {
    ...summary,
    report: createPlanReport(summary),
  }
}
