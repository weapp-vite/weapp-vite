import type { AnalyzeTreemapFilterOption, DashboardTabOption, ThemeOption } from '../types'

export const themeOptions: ThemeOption[] = [
  { value: 'system', label: '跟随系统', iconName: 'theme-system' },
  { value: 'light', label: '亮色', iconName: 'theme-light' },
  { value: 'dark', label: '暗色', iconName: 'theme-dark' },
]

export const dashboardTabs: Array<DashboardTabOption & { description: string, advanced?: boolean }> = [
  { key: 'diagnostics', label: '构建分析', description: '看包体分布，定位异常，对照变化与来源。', iconName: 'metric-health' },
  { key: 'packages', label: '包体与分包', description: '查看主包、分包的体积、预算和产物文件。', iconName: 'tab-packages' },
  { key: 'files', label: '对象检查', description: '关联包、产物与模块，在同一上下文中检查证据、内容和调查。', iconName: 'top-files' },
  { key: 'treemap', label: '体积地图', description: '按面积查看产物体积，逐层定位大文件。', iconName: 'treemap' },
  { key: 'review', label: '评审清单', description: '逐项检查本次构建风险，整理代码评审结论。', iconName: 'metric-bookmark', advanced: true },
  { key: 'graph', label: '产物依赖图', description: '追踪代码产物之间的静态与动态依赖。', iconName: 'tab-modules', advanced: true },
  { key: 'modules', label: '模块与复用', description: '查看模块来源、跨包复用和体积增长归因。', iconName: 'tab-modules', advanced: true },
]

export const treemapFilterOptions: AnalyzeTreemapFilterOption[] = [
  { value: 'all', label: '全部' },
  { value: 'growth', label: '增长' },
  { value: 'duplicates', label: '重复' },
  { value: 'node_modules', label: '依赖' },
  { value: 'source', label: '业务' },
  { value: 'selected-package', label: '当前包' },
]
