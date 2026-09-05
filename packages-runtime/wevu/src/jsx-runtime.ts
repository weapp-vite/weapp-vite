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
  bivarianceHack: (...args: unknown[]) => TReturn
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
