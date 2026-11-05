export interface SourceRange {
  readonly start: number
  readonly end: number
}

export type Platform = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs' | 'qq' | 'ks' | 'ty'
export type Syntax = 'legacy' | 'xml'

/** 与平台无关的模板方言声明。 */
export interface DialectDefinition {
  readonly id: string
  readonly syntax: Syntax
  readonly rawTags: readonly string[]
}

declare const compiledDialectBrand: unique symbol

/** 已校验的不可变方言，供词法核心绑定使用。 */
export interface CompiledDialect extends DialectDefinition {
  readonly [compiledDialectBrand]: true
}

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

export interface Document extends TemplateDocument {
  readonly platform: Platform
  readonly options: ParseOptions
}

/** 核心入口使用的平台无关文档基型。 */
export interface TemplateDocument extends ScanResult {
  readonly source: string
  readonly syntax: Syntax
  readonly children: readonly Node[]
}

export interface TemplateParser {
  readonly dialect: CompiledDialect
  readonly scan: (source: string) => ScanResult
  readonly scanComments: (source: string) => ScanResult
  readonly parse: (source: string) => TemplateDocument
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

/** 编辑会话中的逻辑属性；源码坐标仅由提交后的文档提供。 */
export interface EditAttribute {
  readonly name: string
  readonly value?: string
  readonly quote?: '"' | '\''
}

export interface EditElement {
  readonly kind: 'element'
  readonly name: string
  readonly attributes: readonly EditAttribute[]
  readonly children: readonly EditNode[]
  readonly selfClosing: boolean
}

export interface EditRawNode {
  readonly kind: RawNode['kind']
  readonly data: string
}

export type EditNode = EditElement | EditRawNode

export type EditCallback<State = undefined, Current extends EditNode = EditNode> = (path: EditPath<Current>, state: State) => void | false
export type EditNodeVisitor<State = undefined, Current extends EditNode = EditNode> = EditCallback<State, Current> | {
  enter?: EditCallback<State, Current>
  exit?: EditCallback<State, Current>
}

export interface EditVisitors<State = undefined> {
  enter?: EditCallback<State>
  exit?: EditCallback<State>
  Element?: EditNodeVisitor<State, EditElement>
  Text?: EditNodeVisitor<State, EditRawNode & { readonly kind: 'text' }>
  Comment?: EditNodeVisitor<State, EditRawNode & { readonly kind: 'comment' }>
  Cdata?: EditNodeVisitor<State, EditRawNode & { readonly kind: 'cdata' }>
  Declaration?: EditNodeVisitor<State, EditRawNode & { readonly kind: 'declaration' }>
  Script?: EditNodeVisitor<State, EditRawNode & { readonly kind: 'script' }>
}

/** 路径身份属于单个编辑会话，所有修改在会话结束后失效。 */
export interface EditPath<Current extends EditNode = EditNode> {
  readonly node: Current
  readonly originalNode: Node | undefined
  readonly originalRange: SourceRange | undefined
  readonly parentPath: EditPath | undefined
  readonly key: number
  readonly removed: boolean
  get: (key: 'children') => readonly EditPath[]
  getSibling: (index: number) => EditPath | undefined
  findParent: (predicate: (path: EditPath) => boolean) => EditPath | undefined
  isElement: {
    (): this is EditPath<EditElement>
    <Name extends string>(name: Name): this is EditPath<EditElement & { readonly name: Name }>
  }
  isText: () => this is EditPath<EditRawNode & { readonly kind: 'text' }>
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => EditAttribute | undefined
  rename: (name: string) => void
  renameAttribute: (name: string, nextName: string) => void
  setAttribute: (name: string, value: AttributeValue) => void
  setBooleanAttribute: (name: string) => void
  removeAttribute: (name: string) => void
  replaceText: (value: string | { readonly expression: string }) => void
  remove: () => void
  replaceWith: (source: string) => readonly EditPath[]
  insertBefore: (source: string) => readonly EditPath[]
  insertAfter: (source: string) => readonly EditPath[]
  prepend: (source: string) => readonly EditPath[]
  append: (source: string) => readonly EditPath[]
  traverse: {
    (visitors: EditVisitors): void
    <State>(visitors: EditVisitors<State>, state: State): void
  }
  skip: () => void
  stop: () => void
  requeue: () => void
}

export interface SerializeOptions {
  readonly mode?: 'preserve' | 'canonical'
}
