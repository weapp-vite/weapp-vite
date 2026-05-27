import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { MiniProgramPlatform } from './platform'

export type FunctionPropNameMatcher = string | RegExp

/**
 * 作用域插槽组件资源描述。
 */
export interface ScopedSlotComponentAsset {
  id: string
  componentName: string
  hostComponentName?: string
  slotKey: string
  template: string
  componentGenerics?: Record<string, true>
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
  layoutHosts?: LayoutHostBinding[]
  inlineExpressions?: InlineExpressionAsset[]
  functionPropPaths?: string[]
}

/**
 * 模板转换上下文。
 */
export interface TransformContext {
  source: string
  filename: string
  warnings: string[]
  platform: MiniProgramPlatform
  /**
   * Vue `<script setup>` props 解构重命名映射，key 为模板中使用的本地别名，value 为原始 prop 名。
   */
  propsAliases?: Record<string, string>
  propsDerivedKeys?: string[]
  scriptSetupBindings?: Record<string, unknown>
  htmlTagToWxmlMap?: Record<string, string>
  htmlTagToWxmlTagClass: boolean
  scopedSlotsCompiler: ScopedSlotsCompilerMode
  scopedSlotsRequireProps: boolean
  slotSingleRootNoWrapper: boolean
  slotFallbackWrapper: ResolvedSlotFallbackWrapperConfig
  slotMultipleInstance: boolean
  scopedSlotComponents: ScopedSlotComponentAsset[]
  componentGenerics: Record<string, true>
  componentNameMap?: Record<string, string>
  scopeStack: Array<Set<string>>
  slotPropStack: Array<Record<string, string>>
  rewriteScopedSlot: boolean
  classStyleRuntime: ClassStyleRuntime
  objectLiteralBindMode: ObjectLiteralBindMode
  mustacheInterpolation: MustacheInterpolationMode
  formatWxml: boolean
  classStyleBindings: ClassStyleBinding[]
  classStyleWxs: boolean
  classStyleWxsExtension?: string
  classStyleWxsSrc?: string
  forStack: ForParseResult[]
  forIndexSeed: number
  templateRefs: TemplateRefBinding[]
  templateRefIndexSeed: number
  layoutHosts: LayoutHostBinding[]
  layoutHostIndexSeed: number
  inlineExpressions: InlineExpressionAsset[]
  inlineExpressionSeed: number
  functionPropPaths: Set<string>
  functionPropNames: FunctionPropNameMatcher[]
  wevuComponentTags?: Set<string>
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
  itemAliases?: Record<string, string>
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
  /**
   * Vue `<script setup>` props 解构重命名映射，key 为模板中使用的本地别名，value 为原始 prop 名。
   */
  propsAliases?: Record<string, string>
  propsDerivedKeys?: string[]
  scriptSetupBindings?: Record<string, unknown>
  htmlTagToWxml?: boolean | Record<string, string>
  htmlTagToWxmlTagClass?: boolean
  scopedSlotsCompiler?: ScopedSlotsCompilerMode
  scopedSlotsRequireProps?: boolean
  slotSingleRootNoWrapper?: boolean
  slotFallbackWrapper?: SlotFallbackWrapperConfig
  slotMultipleInstance?: boolean
  classStyleRuntime?: ClassStyleRuntime | 'auto'
  objectLiteralBindMode?: ObjectLiteralBindMode
  mustacheInterpolation?: MustacheInterpolationMode
  formatWxml?: boolean
  wxsExtension?: string
  classStyleWxsSrc?: string
  functionPropNames?: Iterable<FunctionPropNameMatcher>
  wevuComponentTags?: Iterable<string>
  componentNameMap?: Record<string, string>
}

/**
 * 作用域插槽编译模式。
 */
export type ScopedSlotsCompilerMode = 'auto' | 'augmented' | 'off'

/**
 * 命名插槽 fallback 容器策略匹配器。
 */
export type SlotFallbackWrapperMatcher = string | RegExp | Array<string | RegExp>

/**
 * 命名插槽 fallback 容器规则。
 */
export interface SlotFallbackWrapperRule {
  component?: SlotFallbackWrapperMatcher
  componentName?: SlotFallbackWrapperMatcher
  slot?: SlotFallbackWrapperMatcher
  tag?: string
  attrs?: Record<string, string>
  singleRootNoWrapper?: boolean
}

/**
 * 命名插槽 fallback 容器配置。
 */
export type SlotFallbackWrapperConfig = string | {
  tag?: string
  attrs?: Record<string, string>
  singleRootNoWrapper?: boolean
  rules?: SlotFallbackWrapperRule[]
}

/**
 * 已解析的命名插槽 fallback 容器配置。
 */
export interface ResolvedSlotFallbackWrapperConfig {
  tag: string
  attrs?: Record<string, string>
  singleRootNoWrapper?: boolean
  rules: SlotFallbackWrapperRule[]
}

/**
 * 局部命名插槽 fallback 容器配置。
 */
export interface LocalSlotFallbackWrapperConfig {
  tag?: string
  staticClass?: string
  dynamicClassExp?: string
  staticStyle?: string
  dynamicStyleExp?: string
  singleRootNoWrapper?: boolean
}

/**
 * 命名插槽 fallback 容器解析上下文。
 */
export interface SlotFallbackWrapperResolveContext {
  component?: string
  componentName?: string
  slot?: string
  local?: LocalSlotFallbackWrapperConfig
}

/**
 * 已解析的命名插槽 fallback 容器策略。
 */
export interface ResolvedSlotFallbackWrapper {
  tag: string
  attrs?: Record<string, string>
  staticClass?: string
  dynamicClassExp?: string
  staticStyle?: string
  dynamicStyleExp?: string
  singleRootNoWrapper?: boolean
}

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
  errorFallback?: string
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

/**
 * layout 宿主绑定信息。
 */
export interface LayoutHostBinding {
  key: string
  refName?: string
  selector: string
  kind?: 'component'
}
