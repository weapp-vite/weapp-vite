import type { GlobalComponents } from 'wevu'
import type { WeappIntrinsicElements } from './weappIntrinsicElements'

// eslint-disable-next-line ts/no-namespace -- JSX 命名空间用于 jsxImportSource 类型推导。
export declare namespace JSX {
  export type Element = any

  export interface ElementClass {
    $props: Record<string, any>
  }

  export interface ElementAttributesProperty {
    $props: Record<string, any>
  }

  export interface IntrinsicAttributes {
    [key: string]: any
  }

  export interface IntrinsicElements extends GlobalComponents, WeappIntrinsicElements {
    [key: string]: any
  }
}
