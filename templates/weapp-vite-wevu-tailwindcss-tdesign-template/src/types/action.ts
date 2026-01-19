export type ActionTone = 'brand' | 'neutral'
export type ActionType = 'tab' | 'sub'

export interface QuickActionItem {
  key: string
  title: string
  description?: string
  icon?: string
  tag?: string
  tone?: ActionTone
  disabled?: boolean
  path?: string
  type?: ActionType
}
