export interface TemplateCompileResult {
  code: string
  warnings: string[]
}

export interface TransformContext {
  source: string
  filename: string
  warnings: string[]
}

export interface ForParseResult {
  attrs: string[]
  item?: string
  index?: string
  key?: string
}

export type TransformNode = (node: any, context: TransformContext) => string
