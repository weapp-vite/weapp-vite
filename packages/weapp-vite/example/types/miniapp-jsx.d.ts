type MiniProgramElementProps = Record<string, any>

declare namespace JSX {
  interface IntrinsicElements {
    view: MiniProgramElementProps
    text: MiniProgramElementProps
    button: MiniProgramElementProps
    input: MiniProgramElementProps
    textarea: MiniProgramElementProps
    switch: MiniProgramElementProps
    slider: MiniProgramElementProps
    picker: MiniProgramElementProps
  }
}
