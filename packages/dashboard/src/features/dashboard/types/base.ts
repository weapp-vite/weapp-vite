export type PackageType = 'main' | 'subPackage' | 'independent' | 'virtual'
export type ModuleSourceType = 'src' | 'plugin' | 'node_modules' | 'workspace'
export type BuildOrigin = 'main' | 'independent'
export type PackageBudgetStatus = 'warning' | 'critical'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type AnalyzeComparisonMode = 'previous' | 'baseline'
export type AnalyzeTreemapFilterMode = 'all' | 'growth' | 'duplicates' | 'node_modules' | 'source' | 'selected-package'

export type DashboardIconName
  = | 'theme-system'
    | 'theme-light'
    | 'theme-dark'
    | 'nav-menu'
    | 'nav-home'
    | 'nav-analyze'
    | 'nav-activity'
    | 'nav-tokens'
    | 'tab-overview'
    | 'tab-packages'
    | 'tab-modules'
    | 'tab-source'
    | 'status-dark'
    | 'status-light'
    | 'status-live'
    | 'metric-packages'
    | 'metric-subpackages'
    | 'metric-chunks'
    | 'metric-assets'
    | 'metric-size-outline'
    | 'metric-modules'
    | 'metric-duplicates'
    | 'metric-sources'
    | 'metric-copy'
    | 'metric-time'
    | 'metric-entries'
    | 'metric-size'
    | 'treemap'
    | 'top-files'
    | 'subpackages'
    | 'duplicate-modules'
    | 'module-sources'
    | 'file-samples'
    | 'hero-workspace'
    | 'hero-commands'
    | 'hero-system'
    | 'metric-ready'
    | 'metric-health'
    | 'metric-latency'
    | 'metric-quality'
    | 'metric-search'
    | 'metric-history'
    | 'metric-bookmark'
    | 'metric-link'
    | 'metric-reset'
    | 'token-color'
    | 'token-surface'
    | 'token-type'

export type DashboardTab = 'overview' | 'diagnostics' | 'review' | 'treemap' | 'files' | 'source' | 'packages' | 'modules'

export interface ThemeOption {
  value: 'system' | 'light' | 'dark'
  label: string
  iconName: DashboardIconName
}

export interface DashboardTabOption {
  key: DashboardTab
  label: string
  iconName: DashboardIconName
}

export interface AnalyzeTreemapFilterOption {
  value: AnalyzeTreemapFilterMode
  label: string
}
