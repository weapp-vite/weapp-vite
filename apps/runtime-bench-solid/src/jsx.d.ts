declare namespace JSX {
  type Element = unknown

  interface IntrinsicElements {
    [name: string]: Record<string, unknown>
  }
}
