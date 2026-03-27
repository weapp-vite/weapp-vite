export type PackageType = 'main' | 'subPackage' | 'independent' | 'virtual'
export type ModuleSourceType = 'src' | 'plugin' | 'node_modules' | 'workspace'
export type BuildOrigin = 'main' | 'independent'
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
    | 'token-color'
    | 'token-surface'
    | 'token-type'

export interface ModuleInFile {
  id: string
  source: string
  sourceType: ModuleSourceType
  bytes?: number
  originalBytes?: number
}

export interface PackageFileEntry {
  file: string
  type: 'chunk' | 'asset'
  from: BuildOrigin
  size?: number
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
  packages: PackageReport[]
  modules: ModuleUsage[]
  subPackages: SubPackageDescriptor[]
}

export type DashboardTab = 'overview' | 'packages' | 'modules'

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

export interface DashboardMetricCard {
  label: string
  value: string
  iconName: DashboardIconName
  wide?: boolean
}

export interface DashboardNavItem {
  to: string
  label: string
  caption: string
  iconName: DashboardIconName
}
