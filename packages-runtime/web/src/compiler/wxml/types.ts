export interface WxmlCompileOptions {
  id: string
  source: string
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
