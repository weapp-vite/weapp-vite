import type { TemplateInputOptions } from '../../shared/templateInput'

export interface WxmlCompileOptions {
  id: string
  source: string
  /** 当前模板来源与编码；Web 是输出目标，不参与输入规则推断。 */
  input?: TemplateInputOptions
  /** 每个真实依赖独立选择来源；未知扩展名可继承父模板规则。 */
  resolveInput?: (filename: string, inherited: TemplateInputOptions) => TemplateInputOptions
  /** 标签诊断使用的原始模板；布局包装不得改变其文件位置。 */
  diagnosticSource?: string
  /** 原始 AST 已提供入口诊断时直接复用；依赖仍按各自源码采集。 */
  sourceTagDiagnostics?: readonly WxmlTagDiagnostic[]
  resolveTemplatePath: (raw: string, importer: string) => string | undefined
  resolveWxsPath: (raw: string, importer: string) => string | undefined
  navigationBar?: NavigationBarCompileOptions
  componentTags?: Record<string, string>
  dependencyContext?: WxmlDependencyContext
  expandDependencies?: boolean
}

export interface WxmlCompileResult {
  code: string
  dependencies: string[]
  warnings?: string[]
  tagDiagnostics?: WxmlTagDiagnostic[]
}

export interface WxmlTagDiagnostic {
  tag: string
  reason: 'unknown' | 'unsupported'
  filename: string
  line?: number
  column?: number
}

export interface NavigationBarConfig {
  title?: string
  backgroundColor?: string
  textStyle?: string
  frontColor?: string
  loading?: boolean
  navigationStyle?: string
}

export interface NavigationBarCompileOptions {
  config: NavigationBarConfig
}

export interface RenderTextNode {
  type: 'text'
  data: string
}

export interface RenderElementNode {
  type: 'element'
  name: string
  attribs: Record<string, string>
  children?: RenderNode[]
  startIndex?: number
}

export type RenderNode = RenderTextNode | RenderElementNode

export interface InterpolationPart {
  type: 'text' | 'expr'
  value: string
}

export interface TemplateDefinition {
  name: string
  nodes: RenderNode[]
}

export interface IncludeEntry {
  id: string
  importName: string
}

export interface ImportEntry {
  id: string
  importName: string
}

export interface WxsEntry {
  module: string
  kind: 'src' | 'inline'
  importName: string
  value: string
}

export interface WxmlDependencyContext {
  warnings: string[]
  dependencies: string[]
  dependencySet: Set<string>
  visited: Set<string>
  active: Set<string>
  circularWarnings: Set<string>
}
