import type { Diagnostic, LanguageOptions, LanguagePlatform, SourceEdit, SourceRange } from '../types'

export interface TemplateAttribute extends SourceRange {
  name: string
  nameStart: number
  nameEnd: number
  value?: string
  valueStart?: number
  valueEnd?: number
  rawValue?: string
}

export interface TemplateTag extends SourceRange {
  kind: 'tag'
  name: string
  nameStart: number
  nameEnd: number
  closing: boolean
  selfClosing: boolean
  attributes: TemplateAttribute[]
  matching?: number
  parent?: number
}

export interface TemplateRaw extends SourceRange {
  kind: 'text' | 'comment' | 'cdata' | 'declaration' | 'script'
  tagName?: string
}

export type TemplateToken = TemplateTag | TemplateRaw

export interface TemplateReference extends SourceRange {
  kind: 'template-import' | 'template-include' | 'template-name' | 'template-use' | 'script-module' | 'script-import' | 'event'
  name: string
  source?: string
  tagName?: string
  sourceKind?: 'native' | 'compiled'
  language?: 'javascript' | 'typescript'
}

export interface TemplateBinding extends SourceRange {
  name: string
  kind: 'item' | 'index'
  collection: SourceRange & { source: string }
}

export interface TemplateScope extends SourceRange {
  bindings: TemplateBinding[]
}

export interface TemplateScript extends SourceRange {
  tagName: string
  source: string
  sourceKind: 'native' | 'compiled'
  language?: 'javascript' | 'typescript'
  moduleName?: string
}

export interface TemplateExpression extends SourceRange {
  fullStart: number
  fullEnd: number
  source: string
}

export interface TemplateAnalysis {
  platform?: LanguagePlatform
  valid: boolean
  diagnostics: Diagnostic[]
  tokens: TemplateToken[]
  elements: TemplateTag[]
  scopes: TemplateScope[]
  references: TemplateReference[]
  scripts: TemplateScript[]
  expressions: TemplateExpression[]
}

export interface TemplateFormatOptions extends LanguageOptions {
  indent?: string
  printWidth?: number
  wrapAttributes?: number
  tabWidth?: number
  useTabs?: boolean
  singleAttributePerLine?: boolean
  bracketSameLine?: boolean
  endOfLine?: 'lf' | 'crlf' | 'cr' | 'auto'
}

export interface TemplateFormatResult {
  code: string
  changed: boolean
  edits: SourceEdit[]
  diagnostics: Diagnostic[]
}
