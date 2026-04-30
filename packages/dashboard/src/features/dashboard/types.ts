export type PackageType = 'main' | 'subPackage' | 'independent' | 'virtual'
export type ModuleSourceType = 'src' | 'plugin' | 'node_modules' | 'workspace'
export type BuildOrigin = 'main' | 'independent'
export type PackageBudgetStatus = 'warning' | 'critical'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
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
  detail?: string
  iconName: DashboardIconName
  wide?: boolean
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
  file?: string
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

export interface TreemapNodeMetaBase {
  kind: 'package' | 'file' | 'module' | 'asset'
  nodeId: string
  bytes?: number
  totalBytes?: number
  packageId: string
  packageLabel: string
}

export interface TreemapPackageNodeMeta extends TreemapNodeMetaBase {
  kind: 'package'
  packageType: PackageType
  fileCount: number
}

export interface TreemapFileNodeMeta extends TreemapNodeMetaBase {
  kind: 'file'
  fileName: string
  from: BuildOrigin
  childCount: number
  type: PackageFileEntry['type']
}

export interface TreemapModuleNodeMeta extends TreemapNodeMetaBase {
  kind: 'module'
  fileName: string
  source: string
  sourceType: ModuleSourceType
  originalBytes?: number
  packageCount: number
}

export interface TreemapAssetNodeMeta extends TreemapNodeMetaBase {
  kind: 'asset'
  fileName: string
  source: string
}

export type TreemapNodeMeta
  = | TreemapPackageNodeMeta
    | TreemapFileNodeMeta
    | TreemapModuleNodeMeta
    | TreemapAssetNodeMeta

export interface TreemapNode {
  id: string
  name: string
  value: number
  meta: TreemapNodeMeta
  children?: TreemapNode[]
  itemStyle?: Record<string, any>
}

export interface DashboardNavItem {
  to: string
  label: string
  caption: string
  iconName: DashboardIconName
}

export interface WorkspaceCommandItem {
  label: string
  command: string
  note: string
}

export interface WorkspaceActivityItem {
  time: string
  title: string
  summary: string
  tone: 'live' | 'default'
}

export interface WorkspaceDiagnosticItem {
  label: string
  detail: string
  status: string
}

export interface WorkspaceSignalItem {
  label: string
  value: string
  iconName: DashboardIconName
}

export type DashboardRuntimeEventKind = 'command' | 'build' | 'diagnostic' | 'hmr' | 'system'
export type DashboardRuntimeEventLevel = 'info' | 'success' | 'warning' | 'error'

export interface DashboardRuntimeEvent {
  id: string
  kind: DashboardRuntimeEventKind
  level: DashboardRuntimeEventLevel
  title: string
  detail: string
  timestamp: string
  source?: string
  durationMs?: number
  tags?: string[]
}

export interface DashboardRuntimeSourceSummary {
  source: string
  count: number
  errorCount: number
  latestTimestamp: string
  averageDurationMs?: number
}

export interface DashboardRuntimeSourceCardItem extends DashboardRuntimeSourceSummary {
  averageDuration: string
}

export interface DashboardLabelValueItem {
  label: string
  value: string
}

export interface DashboardKeyedLabelItem {
  key: string
  label: string
}

export interface DashboardKeyedLabelValueItem extends DashboardKeyedLabelItem {
  value: string
}

export interface DashboardDetailItem {
  title: string
  meta: string
  value?: string
}

export interface DashboardMetricItem {
  label: string
  value: string | number
}

export interface DashboardTitleBlock {
  title: string
  description?: string
}

export interface DashboardIconFeatureItem extends DashboardTitleBlock {
  iconName: DashboardIconName
  eyebrow?: string
  meta?: string
}

export interface DashboardTokenSwatchItem {
  name: string
  sample: string
}

export interface DashboardTokenGroup {
  title: string
  iconName: DashboardIconName
  tokens: DashboardTokenSwatchItem[]
}

export interface DashboardInfoPillItem {
  label: string
  iconName?: DashboardIconName
}

export type DashboardRuntimeBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error'

export interface DashboardRuntimeBadgeItem {
  label: string
  tone?: DashboardRuntimeBadgeTone
}

export type DashboardSurfaceTone = 'default' | 'strong' | 'muted'
export type DashboardSurfacePadding = 'none' | 'sm' | 'md' | 'header'

export interface DashboardSurfaceSampleItem {
  label: string
  tone: DashboardSurfaceTone
}

export interface DashboardValueOption<T extends string = string> {
  value: T
  label: string
}

export interface DashboardKeyOption<T extends string = string> {
  key: T
  label: string
}
