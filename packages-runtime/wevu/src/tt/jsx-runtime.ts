import type { TtIntrinsicElements } from '@weapp-core/types/tt'
import type { JSX as WevuJSX, WevuJsxGlobalComponents } from 'wevu/jsx-runtime'

export type { TtIntrinsicElementBaseAttributes, TtIntrinsicElements } from '@weapp-core/types/tt'

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

  export interface IntrinsicElements extends WevuJsxGlobalComponents, TtIntrinsicElements {}
}
