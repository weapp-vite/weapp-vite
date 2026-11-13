import type { WevuJsxVNode } from './jsxTypes'

interface WevuJsxClassObject {
  [name: string]: boolean | null | undefined
}
type WevuJsxClassValue = WevuJsxClassObject | WevuJsxClassValue[] | false | null | string | undefined
interface WevuJsxStyleObject {
  [property: string]: null | number | string | undefined
}
type WevuJsxStyleValue = WevuJsxStyleObject | WevuJsxStyleValue[] | false | null | string | undefined
type WevuJsxDatasetAttributes = {
  [name in `data-${string}`]?: unknown
}

export type WevuJsxChild = WevuJsxElement | WevuJsxElement[]
export type WevuJsxElement = WevuJsxVNode | boolean | null | number | string | undefined
export type WevuJsxEventHandler<TReturn = unknown> = {
  // eslint-disable-next-line ts/method-signature-style -- 方法签名用于保留事件回调参数双变，函数属性会退化为逆变。
  bivarianceHack(...args: unknown[]): TReturn
}['bivarianceHack']
export type WevuJsxHostAttributes = {
  id?: number | string
  class?: WevuJsxClassValue
  className?: WevuJsxClassValue
  style?: WevuJsxStyleValue
  hidden?: boolean
  key?: number | string
  onTap?: WevuJsxEventHandler
  catchTap?: WevuJsxEventHandler
  captureBindTap?: WevuJsxEventHandler
  captureCatchTap?: WevuJsxEventHandler
  onLongPress?: WevuJsxEventHandler
  onTouchStart?: WevuJsxEventHandler
  onTouchMove?: WevuJsxEventHandler
  onTouchEnd?: WevuJsxEventHandler
  onTouchCancel?: WevuJsxEventHandler
  catchTouchStart?: WevuJsxEventHandler
  catchTouchMove?: WevuJsxEventHandler
  catchTouchEnd?: WevuJsxEventHandler
  catchTouchCancel?: WevuJsxEventHandler
  captureBindTouchStart?: WevuJsxEventHandler
  captureBindTouchMove?: WevuJsxEventHandler
  captureBindTouchEnd?: WevuJsxEventHandler
  captureBindTouchCancel?: WevuJsxEventHandler
  captureCatchTouchStart?: WevuJsxEventHandler
  captureCatchTouchMove?: WevuJsxEventHandler
  captureCatchTouchEnd?: WevuJsxEventHandler
  captureCatchTouchCancel?: WevuJsxEventHandler
} & WevuJsxDatasetAttributes

export interface WevuJsxGlobalComponents {}

/**
 * JSX `<Teleport>` 的编译期属性；实际转换由 wevu 编译器完成，无需运行时导入。
 */
export interface WevuJsxTeleportProps extends WevuJsxHostAttributes {
  /** 目标容器；仅静态顶层目标（`body`、`html`、`#app`、`#root`）会映射为 `root-portal`。 */
  to: string
  /** 为 `true` 时表示禁用 Teleport，映射时取反输出 `root-portal` 的 `enable`。 */
  disabled?: boolean
  /** 延迟渲染标记；小程序侧忽略。 */
  defer?: boolean
}

declare global {
  /**
   * JSX 全局 Teleport 组件，编译阶段映射为 `root-portal`，无需运行时导入。
   * 使用 `var` 是为了与构建产物中的同名全局声明合并。
   */
  // eslint-disable-next-line vars-on-top -- `declare global` 内需要 var 才能与构建产物声明合并。
  var Teleport: (props: WevuJsxTeleportProps) => WevuJsxElement
}

// eslint-disable-next-line ts/no-namespace -- JSX 命名空间用于 jsxImportSource 类型推导。
export declare namespace JSX {
  export type Element = WevuJsxElement

  export interface ElementClass {
    $props: unknown
  }

  export interface ElementAttributesProperty {
    $props: unknown
  }

  export interface IntrinsicAttributes extends WevuJsxHostAttributes {}

  export interface IntrinsicElements extends WevuJsxGlobalComponents {}
}
