import type { DashboardTabOption, ThemeOption } from '../types'

export const themeOptions: ThemeOption[] = [
  { value: 'system', label: '跟随系统', iconName: 'theme-system' },
  { value: 'light', label: '亮色', iconName: 'theme-light' },
  { value: 'dark', label: '暗色', iconName: 'theme-dark' },
]

export const dashboardTabs: DashboardTabOption[] = [
  { key: 'overview', label: '总览', iconName: 'tab-overview' },
  { key: 'packages', label: '包与产物', iconName: 'tab-packages' },
  { key: 'modules', label: '模块与复用', iconName: 'tab-modules' },
]
