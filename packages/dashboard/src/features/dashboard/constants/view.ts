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

export const dashboardIconClasses = [
  'icon-[mdi--theme-light-dark]',
  'icon-[mdi--white-balance-sunny]',
  'icon-[mdi--moon-waning-crescent]',
  'icon-[mdi--view-dashboard-outline]',
  'icon-[mdi--package-variant-closed]',
  'icon-[mdi--vector-link]',
  'icon-[mdi--circle-slice-8]',
  'icon-[mdi--checkbox-blank-circle]',
  'icon-[mdi--package-variant]',
  'icon-[mdi--layers-triple-outline]',
  'icon-[mdi--chart-tree]',
  'icon-[mdi--file-document-multiple-outline]',
  'icon-[mdi--database-outline]',
  'icon-[mdi--cube-outline]',
  'icon-[mdi--source-branch]',
  'icon-[mdi--content-copy]',
  'icon-[mdi--clock-outline]',
  'icon-[mdi--cube-scan]',
  'icon-[mdi--vector-difference]',
  'icon-[mdi--export-variant]',
  'icon-[mdi--database]',
  'icon-[mdi--chart-treemap]',
  'icon-[mdi--file-star-outline]',
] as const
