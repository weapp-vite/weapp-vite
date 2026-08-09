declare namespace JSX {
  type Element = unknown

  interface IntrinsicElements {
    [name: string]: Record<string, unknown>
  }
}

declare module 'solid-js/dist/solid.js' {
  export * from 'solid-js'
}
