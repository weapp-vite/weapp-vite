import type { CaptureLoadIdentity } from '../captureLoader'

export interface InlineOriginSource {
  id: string
  filename: string
  content: string
}

export interface InlineOriginOccurrence {
  id: string
  kind: 'inline-handler-callee'
  sourceId: string
  inlineId: string
  expression: { start: number, end: number, text: string }
  callee: { start: number, end: number, name: string }
  /** 本轮仅为全部直接 primitive 参数出具额外证据；缺省时仍保留 callee 来源，不表示 native 回退。 */
  fragments?: InlineOriginFragment[]
}

export interface InlineOriginFragment {
  kind: 'inline-handler-argument-literal'
  role: 'copied'
  generated: { start: number, end: number, text: string }
  source: { start: number, end: number, text: string }
}

/** 解析阶段复制的 primitive token 摘要；不持有 Babel AST 引用。 */
export interface InlineOriginArgumentToken {
  readonly start: number
  readonly end: number
  readonly text: string
  readonly type: 'StringLiteral' | 'NumericLiteral' | 'BooleanLiteral' | 'NullLiteral'
  readonly value: string | number | boolean | null
}

export interface InlineProvenance {
  schemaVersion: 1
  coordinateEncoding: 'utf16'
  sources: InlineOriginSource[]
  occurrences: InlineOriginOccurrence[]
}

export interface InlineOriginUnsupported {
  stage: 'template' | 'directive' | 'parse' | 'asset' | 'request'
  reason: string
  filename?: string
  inlineId?: string
  expressionStart?: number
}

export interface InlineOriginSnapshot {
  sourceCount: number
  occurrenceCount: number
  templateCalls: number
  directiveCalls: number
  parsedCalls: number
  registeredCalls: number
  requestCalls: number
  sources: InlineOriginSource[]
  occurrences: InlineOriginOccurrence[]
  unsupported: InlineOriginUnsupported[]
  loaders: CaptureLoadIdentity[]
}

export interface OriginNode {
  type: string
  start?: number | null
  end?: number | null
  name?: string
  optional?: boolean | null
  computed?: boolean
  callee?: OriginNode | null
  object?: OriginNode | null
  property?: OriginNode | null
}

export interface OriginLocation {
  start: { offset: number }
  end: { offset: number }
  source?: string
}

export interface OriginTemplate {
  content: string
  src?: string
  loc: OriginLocation
}

export interface OriginDirective {
  exp?: { content?: string, loc?: OriginLocation }
}

export interface OriginContext {
  source: string
  filename: string
}

export interface OriginAsset {
  id: string
  expression: string
  parameterNames: { context: string, scope: string, event: string }
}

export interface TemplateOwner {
  source: InlineOriginSource
  template: string
  start: number
  end: number
}

export interface DirectiveOwner {
  template: TemplateOwner
  expression: InlineOriginOccurrence['expression']
  inlineSource: string
}

export type OriginCheck<T> = { value: T } | { reason: string }
