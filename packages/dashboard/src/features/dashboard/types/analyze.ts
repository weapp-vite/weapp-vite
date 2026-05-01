import type { BuildOrigin, ModuleSourceType, PackageBudgetStatus, PackageType } from './base'

export interface ModuleInFile {
  id: string
  source: string
  sourceType: ModuleSourceType
  bytes?: number
  originalBytes?: number
}

export interface AnalyzeBudgetConfig {
  totalBytes: number
  mainBytes: number
  subPackageBytes: number
  independentBytes: number
  warningRatio: number
  source: 'config' | 'default'
}

export interface AnalyzeHistoryMetadata {
  enabled: boolean
  dir: string
  limit: number
  latestSnapshot?: string
}

export interface AnalyzeSubpackagesMetadata {
  generatedAt: string
  budgets: AnalyzeBudgetConfig
  history: AnalyzeHistoryMetadata
}

export interface PackageFileEntry {
  file: string
  type: 'chunk' | 'asset'
  from: BuildOrigin
  size?: number
  gzipSize?: number
  brotliSize?: number
  isEntry?: boolean
  modules?: ModuleInFile[]
  source?: string
}

export interface PackageReport {
  id: string
  label: string
  type: PackageType
  files: PackageFileEntry[]
}

export interface ModuleUsage {
  id: string
  source: string
  sourceType: ModuleSourceType
  packages: Array<{ packageId: string, files: string[] }>
}

export interface SubPackageDescriptor {
  root: string
  independent: boolean
  name?: string
}

export interface AnalyzeSubpackagesResult {
  metadata?: AnalyzeSubpackagesMetadata
  packages: PackageReport[]
  modules: ModuleUsage[]
  subPackages: SubPackageDescriptor[]
}

export interface AnalyzeHistorySnapshot {
  id: string
  capturedAt: string
  label: string
  result: AnalyzeSubpackagesResult
  totalBytes: number
  compressedBytes: number
  packageCount: number
  moduleCount: number
  duplicateCount: number
}

export interface SummaryMetric {
  label: string
  value: number
}

export interface AnalyzeDashboardSummary {
  packageCount: number
  moduleCount: number
  duplicateCount: number
  totalBytes: number
  gzipBytes: number
  brotliBytes: number
  estimatedCompressedBytes: number
  compressedBytes: number
  compressedSizeSource: 'real' | 'estimated'
  sizeDeltaBytes?: number
  compressedDeltaBytes?: number
  subpackageCount: number
  entryCount: number
  budgetWarningCount: number
}

export interface PackageInsight {
  id: string
  label: string
  type: PackageType
  totalBytes: number
  gzipBytes: number
  brotliBytes: number
  compressedBytes: number
  compressedSizeSource: 'real' | 'estimated'
  sizeDeltaBytes?: number
  fileCount: number
  chunkCount: number
  assetCount: number
  moduleCount: number
  duplicateModuleCount: number
  entryFileCount: number
  topFiles: Array<{
    file: string
    size: number
    gzipSize?: number
    brotliSize?: number
    compressedSize: number
    compressedSizeSource: 'real' | 'estimated'
    sizeDeltaBytes?: number
    type: PackageFileEntry['type']
    from: BuildOrigin
    isEntry: boolean
    moduleCount: number
  }>
}

export interface LargestFileEntry {
  packageId: string
  packageLabel: string
  packageType: PackageType
  file: string
  size: number
  gzipSize?: number
  brotliSize?: number
  compressedSize: number
  compressedSizeSource: 'real' | 'estimated'
  sizeDeltaBytes?: number
  type: PackageFileEntry['type']
  from: BuildOrigin
  isEntry: boolean
  moduleCount: number
  modules?: ModuleInFile[]
  source?: string
}

export interface SelectedFileModuleDetail {
  key: string
  source: string
  sourceType: ModuleSourceType
  bytes: number
  originalBytes?: number
  duplicatePackageCount: number
  estimatedSavingBytes: number
}

export interface DuplicateModuleEntry {
  id: string
  source: string
  sourceType: ModuleSourceType
  packageCount: number
  bytes: number
  estimatedSavingBytes: number
  advice: string
  packages: Array<{
    packageId: string
    packageLabel: string
    files: string[]
  }>
}

export interface ModuleSourceSummary {
  sourceType: ModuleSourceType
  sourceCategory: string
  count: number
  bytes: number
}

export interface PackageBudgetWarning {
  id: string
  label: string
  scope: 'total' | PackageType
  currentBytes: number
  limitBytes: number
  ratio: number
  status: PackageBudgetStatus
}

export interface PackageBudgetLimitItem {
  key: string
  label: string
  value: string
  source: 'config' | 'default'
}

export interface IncrementAttributionEntry {
  key: string
  label: string
  category: string
  packageLabel: string
  packageId?: string
  file?: string
  moduleId?: string
  sourceType?: ModuleSourceType
  currentBytes: number
  previousBytes: number
  deltaBytes: number
  advice: string
}

export interface IncrementAttributionSummary {
  category: string
  count: number
  deltaBytes: number
}
