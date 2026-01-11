// eslint-disable-next-line ts/no-namespace -- JSX namespace is required for jsxImportSource typing.
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

  export interface IntrinsicElements {
    [key: string]: any
  }
}
