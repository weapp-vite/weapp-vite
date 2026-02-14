import type { Expression } from '@babel/types'
import type { MiniProgramPlatform } from './platform'

/**
 * 作用域插槽组件资源描述。
 */
export interface ScopedSlotComponentAsset {
  id: string
  componentName: string
  slotKey: string
  template: string
  classStyleBindings?: ClassStyleBinding[]
  classStyleWxs?: boolean
  inlineExpressions?: InlineExpressionAsset[]
}

/**
 * 内联表达式资源描述。
 */
export interface InlineExpressionIndexBindingAsset {
  key: string
  binding: string
}

/**
 * 内联表达式作用域恢复器描述。
 */
export interface InlineExpressionScopeResolverAsset {
  key: string
  expression: string
}

/**
 * 内联表达式资源描述。
 */
export interface InlineExpressionAsset {
  id: string
  expression: string
  scopeKeys: string[]
  indexBindings?: InlineExpressionIndexBindingAsset[]
  scopeResolvers?: InlineExpressionScopeResolverAsset[]
}

/**
 * 模板编译结果。
 */
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

/**
 * 模板转换上下文。
 */
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
  objectLiteralBindMode: ObjectLiteralBindMode
  mustacheInterpolation: MustacheInterpolationMode
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

/**
 * v-for 解析结果。
 */
export interface ForParseResult {
  listExp?: string
  listExpAst?: Expression
  item?: string
  index?: string
  key?: string
}

/**
 * 节点转换函数。
 */
export type TransformNode = (node: any, context: TransformContext) => string

/**
 * 模板编译选项。
 */
export interface TemplateCompileOptions {
  platform?: MiniProgramPlatform
  scopedSlotsCompiler?: ScopedSlotsCompilerMode
  scopedSlotsRequireProps?: boolean
  slotMultipleInstance?: boolean
  classStyleRuntime?: ClassStyleRuntime | 'auto'
  objectLiteralBindMode?: ObjectLiteralBindMode
  mustacheInterpolation?: MustacheInterpolationMode
  wxsExtension?: string
  classStyleWxsSrc?: string
}

/**
 * 作用域插槽编译模式。
 */
export type ScopedSlotsCompilerMode = 'auto' | 'augmented' | 'off'

/**
 * class/style 运行时模式。
 */
export type ClassStyleRuntime = 'wxs' | 'js'

/**
 * 对象字面量 v-bind 产物模式。
 */
export type ObjectLiteralBindMode = 'runtime' | 'inline'

/**
 * Mustache 输出风格。
 */
export type MustacheInterpolationMode = 'compact' | 'spaced'

/**
 * class/style 绑定信息。
 */
export interface ClassStyleBinding {
  name: string
  type: 'class' | 'style' | 'bind'
  exp: string
  expAst?: Expression
  forStack: ForParseResult[]
}

/**
 * template ref 绑定信息。
 */
export interface TemplateRefBinding {
  selector: string
  inFor: boolean
  name?: string
  expAst?: Expression
  kind?: 'component' | 'element'
}
