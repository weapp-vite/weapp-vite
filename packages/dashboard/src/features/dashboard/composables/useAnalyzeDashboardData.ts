import type { Ref } from 'vue'
import type { AnalyzeSubpackagesResult } from '../types'
import { computed } from 'vue'
import { createBudgetLimitItems, createBudgetWarnings } from '../utils/analyzeDataBudgets'
import { createIncrementAttribution, createIncrementSummary } from '../utils/analyzeDataIncrements'
import { createDuplicateModules, createModuleSourceSummaries } from '../utils/analyzeDataModules'
import { createAnalyzeSummary, createLargestFiles, createPackageInsights, createPackageTypeSummary } from '../utils/analyzeDataPackages'
import { createComparisonMaps, createModuleInfoMap } from '../utils/analyzeDataShared'

export function useAnalyzeDashboardData(
  resultRef: Ref<AnalyzeSubpackagesResult | null>,
  previousResultRef?: Ref<AnalyzeSubpackagesResult | null>,
) {
  const previousMaps = computed(() => createComparisonMaps(previousResultRef?.value ?? null))
  const packageLabelMap = computed(() =>
    new Map((resultRef.value?.packages ?? []).map(pkg => [pkg.id, pkg.label])),
  )
  const packageTypeMap = computed(() =>
    new Map((resultRef.value?.packages ?? []).map(pkg => [pkg.id, pkg.type])),
  )
  const moduleInfoMap = computed(() => createModuleInfoMap(resultRef.value))
  const budgetWarnings = computed(() => createBudgetWarnings(resultRef.value))
  const budgetLimitItems = computed(() => createBudgetLimitItems(resultRef.value))
  const incrementAttribution = computed(() => createIncrementAttribution({
    result: resultRef.value,
    previousResult: previousResultRef?.value,
    previousMaps: previousMaps.value,
    moduleInfoMap: moduleInfoMap.value,
  }))
  const incrementSummary = computed(() => createIncrementSummary(incrementAttribution.value))
  const summary = computed(() => createAnalyzeSummary({
    result: resultRef.value,
    previousMaps: previousMaps.value,
    budgetWarnings: budgetWarnings.value,
  }))
  const packageTypeSummary = computed(() => createPackageTypeSummary(resultRef.value))
  const packageInsights = computed(() => createPackageInsights(resultRef.value, previousMaps.value))
  const largestFiles = computed(() => createLargestFiles(resultRef.value, previousMaps.value.fileBytes))
  const duplicateModules = computed(() => createDuplicateModules({
    result: resultRef.value,
    moduleInfoMap: moduleInfoMap.value,
    packageLabelMap: packageLabelMap.value,
    packageTypeMap: packageTypeMap.value,
  }))
  const moduleSourceSummary = computed(() => createModuleSourceSummaries(resultRef.value, moduleInfoMap.value))

  return {
    summary,
    packageTypeSummary,
    packageInsights,
    largestFiles,
    duplicateModules,
    moduleSourceSummary,
    budgetWarnings,
    budgetLimitItems,
    incrementAttribution,
    incrementSummary,
    subPackages: computed(() => resultRef.value?.subPackages ?? []),
  }
}
