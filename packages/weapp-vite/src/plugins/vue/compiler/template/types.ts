import type { MiniProgramPlatform } from './platform'

export interface TemplateCompileResult {
  code: string
  warnings: string[]
}

export interface TransformContext {
  source: string
  filename: string
  warnings: string[]
  platform: MiniProgramPlatform
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
}
