import type { JSX as WevuJSX, WevuJsxGlobalComponents } from 'wevu/jsx-runtime'
import type { WeappIntrinsicElements } from '../weappIntrinsicElements'

export type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicElements } from '../weappIntrinsicElements'
export type {
  WevuJsxChild,
  WevuJsxElement,
  WevuJsxEventHandler,
  WevuJsxGlobalComponents,
  WevuJsxHostAttributes,
} from 'wevu/jsx-runtime'

// eslint-disable-next-line ts/no-namespace -- JSX 命名空间用于 jsxImportSource 类型推导。
export declare namespace JSX {
  export type Element = WevuJSX.Element

  export interface ElementClass extends WevuJSX.ElementClass {}

  export interface ElementAttributesProperty extends WevuJSX.ElementAttributesProperty {}

  export interface IntrinsicAttributes extends WevuJSX.IntrinsicAttributes {}

  export interface IntrinsicElements extends WevuJsxGlobalComponents, WeappIntrinsicElements {}
}
