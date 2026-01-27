import type { Expression } from '@babel/types'
import type { MiniProgramPlatform } from './platform'

export interface ScopedSlotComponentAsset {
  id: string
  componentName: string
  slotKey: string
  template: string
  classStyleBindings?: ClassStyleBinding[]
  classStyleWxs?: boolean
  inlineExpressions?: InlineExpressionAsset[]
}

export interface InlineExpressionAsset {
  id: string
  expression: string
  scopeKeys: string[]
}

export interface TemplateCompileResult {
  code: string
  warnings: string[]
  scopedSlotComponents?: ScopedSlotComponentAsset[]
  componentGenerics?: Record<string, true>
  classStyleRuntime?: ClassStyleRuntime
  classStyleBindings?: ClassStyleBinding[]
  classStyleWxs?: boolean
  templateRefs?: TemplateRefBinding[]
  inlineExpressions?: InlineExpressionAsset[]
}

export interface TransformContext {
  source: string
  filename: string
  warnings: string[]
  platform: MiniProgramPlatform
  scopedSlotsCompiler: ScopedSlotsCompilerMode
  scopedSlotsRequireProps: boolean
  slotMultipleInstance: boolean
  scopedSlotComponents: ScopedSlotComponentAsset[]
  componentGenerics: Record<string, true>
  scopeStack: Array<Set<string>>
  slotPropStack: Array<Record<string, string>>
  rewriteScopedSlot: boolean
  classStyleRuntime: ClassStyleRuntime
  classStyleBindings: ClassStyleBinding[]
  classStyleWxs: boolean
  classStyleWxsExtension?: string
  classStyleWxsSrc?: string
  forStack: ForParseResult[]
  forIndexSeed: number
  templateRefs: TemplateRefBinding[]
  templateRefIndexSeed: number
  inlineExpressions: InlineExpressionAsset[]
  inlineExpressionSeed: number
}

export interface ForParseResult {
  listExp?: string
  listExpAst?: Expression
  item?: string
  index?: string
  key?: string
}

export type TransformNode = (node: any, context: TransformContext) => string

export interface TemplateCompileOptions {
  platform?: MiniProgramPlatform
  scopedSlotsCompiler?: ScopedSlotsCompilerMode
  scopedSlotsRequireProps?: boolean
  slotMultipleInstance?: boolean
  classStyleRuntime?: ClassStyleRuntime | 'auto'
  wxsExtension?: string
  classStyleWxsSrc?: string
}

export type ScopedSlotsCompilerMode = 'auto' | 'augmented' | 'off'

export type ClassStyleRuntime = 'wxs' | 'js'

export interface ClassStyleBinding {
  name: string
  type: 'class' | 'style'
  exp: string
  expAst?: Expression
  forStack: ForParseResult[]
}

export interface TemplateRefBinding {
  selector: string
  inFor: boolean
  name?: string
  expAst?: Expression
  kind?: 'component' | 'element'
}
