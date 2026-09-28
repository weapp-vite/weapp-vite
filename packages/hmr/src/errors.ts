export class CompilerHmrResyncError extends Error {
  constructor(readonly files: readonly string[], message: string) {
    super(message)
    this.name = 'CompilerHmrResyncError'
  }
}
