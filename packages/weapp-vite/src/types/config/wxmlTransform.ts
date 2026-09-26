import type { MpPlatform } from './foundation'

/** 模板属性的新值；字符串为字面量，表达式只生成绑定而不在构建端求值。 */
export type WxmlAttributeValue = string | number | boolean | { expression: string }

/** 源码位置使用从零开始的偏移及从一开始的行列。 */
export interface WxmlSourceLocation {
  readonly offset: number
  readonly line: number
  readonly column: number
}

/** 原始属性内容不解码、不求值；无值属性的 rawValue 为 null。 */
export interface WxmlAttribute {
  readonly name: string
  readonly rawValue: string | null
  readonly quote: string | undefined
}

/** 父节点只提供观察接口，不允许通过子节点改写父树。 */
export interface WxmlElementInfo {
  /** 当前未删除的直接子标签；不包含文本、注释或脚本模块内容。 */
  readonly children: readonly WxmlElementInfo[]
  readonly tagName: string
  readonly attributes: readonly WxmlAttribute[]
  readonly parent: WxmlElementInfo | undefined
  readonly location: WxmlSourceLocation
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => WxmlAttribute | undefined
}

/** 当前节点的编辑句柄仅在本次 edit 调用中有效。 */
export interface WxmlTransformNode extends WxmlElementInfo {
  readonly children: readonly WxmlTransformNode[]
  /** 按源码深度优先顺序遍历后代，不含自身；必须等待完成。 */
  walk: (visitor: WxmlTransformVisitor) => Promise<void>
  /** 只跳过当前回调所属遍历的后代，不改变其他遍历。 */
  skipChildren: () => void
  setAttribute: (name: string, value: WxmlAttributeValue) => void
  setBooleanAttribute: (name: string) => void
  renameAttribute: (from: string, to: string) => void
  removeAttribute: (name: string) => void
  renameTag: (name: string) => void
  remove: () => void
}

export type WxmlTransformVisitor = (node: WxmlTransformNode) => void | Promise<void>
export type WxmlTransformResult = string | null | void

/** 函数接收当前平台的输出模板；源码阶段依赖由原有组件配置负责。 */
export interface WxmlTransformContext {
  readonly fileName: string
  readonly root: string
  readonly platform: MpPlatform
  readonly mode: string
  readonly isDev: boolean
  readonly subPackageRoot: string | undefined
  edit: (code: string, visitor: WxmlTransformVisitor) => Promise<string>
  addWatchFile: (file: string) => void
  warn: (message: string) => void
  error: (message: string) => never
}

export type WxmlTransform = (code: string, context: WxmlTransformContext) => WxmlTransformResult | Promise<WxmlTransformResult>
