import type { DashboardTabOption, ThemeOption } from '../types'

export const themeOptions: ThemeOption[] = [
  { value: 'system', label: '跟随系统', iconClass: 'icon-[mdi--theme-light-dark]' },
  { value: 'light', label: '亮色', iconClass: 'icon-[mdi--white-balance-sunny]' },
  { value: 'dark', label: '暗色', iconClass: 'icon-[mdi--moon-waning-crescent]' },
]

export const dashboardTabs: DashboardTabOption[] = [
  { key: 'overview', label: '总览', iconClass: 'icon-[mdi--view-dashboard-outline]' },
  { key: 'packages', label: '包与产物', iconClass: 'icon-[mdi--package-variant-closed]' },
  { key: 'modules', label: '模块与复用', iconClass: 'icon-[mdi--vector-link]' },
]
