import type { MiniProgramPlatform } from './platform'

export interface ScopedSlotComponentAsset {
  id: string
  componentName: string
  slotKey: string
  template: string
}

export interface TemplateCompileResult {
  code: string
  warnings: string[]
  scopedSlotComponents?: ScopedSlotComponentAsset[]
  componentGenerics?: Record<string, true>
}

export interface TransformContext {
  source: string
  filename: string
  warnings: string[]
  platform: MiniProgramPlatform
  scopedSlotsCompiler: ScopedSlotsCompilerMode
  slotMultipleInstance: boolean
  scopedSlotComponents: ScopedSlotComponentAsset[]
  componentGenerics: Record<string, true>
  scopeStack: Array<Set<string>>
  slotPropStack: Array<Record<string, string>>
  rewriteScopedSlot: boolean
}

export interface ForParseResult {
  listExp?: string
  item?: string
  index?: string
  key?: string
}

export type TransformNode = (node: any, context: TransformContext) => string

export interface TemplateCompileOptions {
  platform?: MiniProgramPlatform
  scopedSlotsCompiler?: ScopedSlotsCompilerMode
  slotMultipleInstance?: boolean
}

export type ScopedSlotsCompilerMode = 'auto' | 'augmented'
