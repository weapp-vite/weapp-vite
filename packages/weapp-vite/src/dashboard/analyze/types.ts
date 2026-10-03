import type { ModuleSourceType, PackageType } from '../../analyze/subpackages/types'

export interface AnalyzeBudgetCheckItem {
  id: string
  label: string
  scope: 'total' | PackageType
  currentBytes: number
  limitBytes: number
  ratio: number
  status: 'ok' | 'warning' | 'exceeded'
}

export interface DuplicateModuleInsight {
  id: string
  source: string
  sourceType: ModuleSourceType
  packageCount: number
  bytes: number
  estimatedSavingBytes: number
  packages: string[]
  hasIndependentPackage: boolean
  advice: string
}

export interface AnalyzeSizeChange {
  key: string
  label: string
  change: 'added' | 'removed' | 'increased' | 'decreased' | 'unmeasured'
  currentBytes: number | null
  previousBytes: number | null
  deltaBytes: number | null
  packageId?: string
  packageLabel?: string
  file?: string
  moduleId?: string
  sourceType?: ModuleSourceType
  category?: string
  advice?: string
}

export interface AnalyzeComparison {
  currentBytes: number | null
  previousBytes: number | null
  deltaBytes: number | null
  currentUnmeasuredFiles: number
  previousUnmeasuredFiles: number
  packages: AnalyzeSizeChange[]
  files: AnalyzeSizeChange[]
  modules: AnalyzeSizeChange[]
}
