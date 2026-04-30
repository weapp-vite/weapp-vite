export type AnalyzeComponentSuggestionKind
  = | 'move-to-subpackage'
    | 'split-or-async'
    | 'shared-subpackage-or-placeholder'

export interface AnalyzeComponentSuggestion {
  kind: AnalyzeComponentSuggestionKind
  message: string
  component: string
  componentPackage: string
  targetPackage?: string
  pagePackages: string[]
}

export interface AnalyzeComponentPageUsage {
  page: string
  packageId: string
  usageCount: number
}

export interface AnalyzeComponentUsage {
  component: string
  componentPackage: string
  totalUsageCount: number
  pageUsageCount: number
  pages: AnalyzeComponentPageUsage[]
  suggestions: AnalyzeComponentSuggestion[]
}

export interface AnalyzeComponentJsonConfig {
  file: string
  config: unknown
}
