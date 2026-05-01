import type { AnalyzeTreemapFilterOption, DashboardTabOption, ThemeOption } from '../types'

export const themeOptions: ThemeOption[] = [
  { value: 'system', label: '跟随系统', iconName: 'theme-system' },
  { value: 'light', label: '亮色', iconName: 'theme-light' },
  { value: 'dark', label: '暗色', iconName: 'theme-dark' },
]

export const dashboardTabs: DashboardTabOption[] = [
  { key: 'overview', label: '总览', iconName: 'tab-overview' },
  { key: 'diagnostics', label: '诊断', iconName: 'metric-health' },
  { key: 'review', label: '评审清单', iconName: 'metric-bookmark' },
  { key: 'treemap', label: '体积地图', iconName: 'treemap' },
  { key: 'files', label: '文件详情', iconName: 'top-files' },
  { key: 'source', label: '源码对比', iconName: 'tab-source' },
  { key: 'packages', label: '包与产物', iconName: 'tab-packages' },
  { key: 'modules', label: '模块与复用', iconName: 'tab-modules' },
]

export const treemapFilterOptions: AnalyzeTreemapFilterOption[] = [
  { value: 'all', label: '全部' },
  { value: 'growth', label: '增长' },
  { value: 'duplicates', label: '重复' },
  { value: 'node_modules', label: '依赖' },
  { value: 'source', label: '业务' },
  { value: 'selected-package', label: '当前包' },
]
