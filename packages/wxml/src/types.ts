export interface SourceRange {
  readonly start: number
  readonly end: number
}

export type Platform = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs' | 'qq' | 'ks' | 'ty'
export type Syntax = 'legacy' | 'xml'

/** 仅在结束边界已确定时提供完整插值的 UTF-16 半开范围，属性外层引号不在范围内。 */
export interface InterpolationRecovery extends SourceRange {
  readonly kind: 'interpolation'
}

export interface Diagnostic extends SourceRange {
  readonly code: string
  readonly message: string
  readonly severity: 'error' | 'warning' | 'info'
  readonly recovery?: InterpolationRecovery
}

export interface Attribute extends SourceRange {
  readonly name: string
  readonly nameStart: number
  readonly nameEnd: number
  readonly value?: string
  readonly valueStart?: number
  readonly valueEnd?: number
  readonly rawValue?: string
  readonly quote?: '"' | '\''
}

export interface TagToken extends SourceRange {
  readonly kind: 'tag'
  readonly name: string
  readonly nameStart: number
  readonly nameEnd: number
  readonly closing: boolean
  readonly selfClosing: boolean
  readonly attributes: readonly Attribute[]
  readonly matching?: number
  readonly parent?: number
}

export interface RawToken extends SourceRange {
  readonly kind: 'text' | 'comment' | 'cdata' | 'declaration' | 'script'
  readonly tagName?: string
}

export type Token = TagToken | RawToken

export interface ScriptBoundaryCandidates {
  readonly closingTag?: SourceRange
  readonly trailingComment?: number
  readonly commentClosings?: readonly (SourceRange & { readonly block: boolean })[]
}

export interface ParseOptions {
  readonly platform?: Platform
  readonly syntax?: Syntax
  readonly rawTags?: readonly string[]
  readonly resolveScriptBoundary?: (source: string, start: number, tagName: string, candidates: ScriptBoundaryCandidates) => SourceRange | undefined
}

export interface ScanResult {
  readonly tokens: readonly Token[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface ElementNode extends SourceRange {
  readonly kind: 'element'
  readonly name: string
  readonly attributes: readonly Attribute[]
  readonly children: readonly Node[]
  readonly opening: TagToken
  readonly closing?: TagToken
  readonly selfClosing: boolean
}

export interface RawNode extends RawToken {
  readonly data: string
}

export type Node = ElementNode | RawNode

export interface Document extends ScanResult {
  readonly source: string
  readonly platform: Platform
  readonly syntax: Syntax
  readonly children: readonly Node[]
  readonly options: ParseOptions
}

export interface Visitor {
  enter?: (node: Node, parent: ElementNode | undefined) => void | false
  leave?: (node: Node, parent: ElementNode | undefined) => void
}

export type AttributeValue = string | number | boolean | { readonly expression: string }

export interface EditableNode {
  readonly node: Node
  rename: (name: string) => void
  setAttribute: (name: string, value: AttributeValue) => void
  setBooleanAttribute: (name: string) => void
  removeAttribute: (name: string) => void
  replaceText: (value: string | { readonly expression: string }) => void
  remove: () => void
  replaceWith: (source: string) => void
  insertBefore: (source: string) => void
  insertAfter: (source: string) => void
  prepend: (source: string) => void
  append: (source: string) => void
}

export type EditVisitor = (node: EditableNode) => void | false

export interface SerializeOptions {
  readonly mode?: 'preserve' | 'canonical'
}
