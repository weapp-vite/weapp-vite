import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from './base'

export interface TabBarOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  animation?: boolean
}

export interface TabBarIndexOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  index: number
}

export interface SetTabBarItemOptions extends TabBarIndexOptions {
  text?: string
  iconPath?: string
  selectedIconPath?: string
}

export interface SetTabBarStyleOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  color?: string
  selectedColor?: string
  backgroundColor?: string
  borderStyle?: 'black' | 'white'
}

export interface SetTabBarBadgeOptions extends TabBarIndexOptions {
  text: string
}
