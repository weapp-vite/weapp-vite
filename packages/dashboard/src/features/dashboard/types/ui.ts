import type { DashboardIconName } from './base'

export interface DashboardMetricCard {
  label: string
  value: string
  detail?: string
  iconName: DashboardIconName
  wide?: boolean
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
