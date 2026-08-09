/// <reference types="miniprogram-api-typings" />
import type { GlobalComponents } from 'wevu'
import type { MiniProgramIntrinsicElements } from './miniprogramIntrinsicElements'
import type { WevuJsxVNode } from './runtime/jsxIsland'

export type WevuJsxChild = WevuJsxElement | WevuJsxElement[]
export type WevuJsxElement = WevuJsxVNode | boolean | null | number | string | undefined

// eslint-disable-next-line ts/no-namespace -- JSX 命名空间用于 jsxImportSource 类型推导。
export declare namespace JSX {
  export type Element = WevuJsxElement

  export interface ElementClass {
    $props: Record<string, any>
  }

  export interface ElementAttributesProperty {
    $props: Record<string, any>
  }

  export interface IntrinsicAttributes {
    key?: number | string
  }

  export interface IntrinsicElements extends GlobalComponents, MiniProgramIntrinsicElements {}
}
