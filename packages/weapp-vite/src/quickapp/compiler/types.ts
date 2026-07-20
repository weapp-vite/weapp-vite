export interface QuickAppComponentImport {
  name: string
  source: string
}

export interface QuickAppVueCompileResult {
  code: string
  components: QuickAppComponentImport[]
}
