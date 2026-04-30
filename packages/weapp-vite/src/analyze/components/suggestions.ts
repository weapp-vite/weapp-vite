import type { AnalyzeComponentPageUsage, AnalyzeComponentSuggestion } from './types'

export interface ComponentSuggestionUsage {
  component: string
  componentPackage: string
  pages: Map<string, AnalyzeComponentPageUsage>
  crossPackageUsageCount: number
  placeholderCoveredCrossPackageUsageCount: number
}

export function createComponentSuggestion(
  usage: ComponentSuggestionUsage,
): AnalyzeComponentSuggestion | undefined {
  if (usage.componentPackage !== '__main__' || usage.crossPackageUsageCount === 0) {
    return undefined
  }

  if (usage.crossPackageUsageCount === usage.placeholderCoveredCrossPackageUsageCount) {
    return undefined
  }

  const pagePackages = Array.from(new Set(Array.from(usage.pages.values()).map(page => page.packageId)))
    .sort((left, right) => {
      if (left === '__main__') {
        return -1
      }
      if (right === '__main__') {
        return 1
      }
      return left.localeCompare(right)
    })
  const subPackageIds = pagePackages.filter(packageId => packageId !== '__main__')
  const usedByMain = pagePackages.includes('__main__')

  if (subPackageIds.length === 1 && !usedByMain) {
    const targetPackage = subPackageIds[0]
    return {
      kind: 'move-to-subpackage',
      component: usage.component,
      componentPackage: usage.componentPackage,
      targetPackage,
      pagePackages,
      message: `主包组件 ${usage.component} 仅被分包 ${targetPackage} 使用，建议评估移动到该分包。`,
    }
  }

  if (subPackageIds.length > 1) {
    return {
      kind: 'shared-subpackage-or-placeholder',
      component: usage.component,
      componentPackage: usage.componentPackage,
      pagePackages,
      message: `主包组件 ${usage.component} 被多个分包使用，建议评估分包归属、共享策略或 componentPlaceholder。`,
    }
  }

  if (usedByMain && subPackageIds.length > 0) {
    return {
      kind: 'split-or-async',
      component: usage.component,
      componentPackage: usage.componentPackage,
      pagePackages,
      message: `主包组件 ${usage.component} 同时被主包和分包使用，建议评估组件拆分、归属或异步化策略。`,
    }
  }
}
