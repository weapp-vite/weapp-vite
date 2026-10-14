export class CompilerHmrResyncError extends Error {
  constructor(readonly files: readonly string[], message: string) {
    super(message)
    this.name = 'CompilerHmrResyncError'
  }
}

/** @internal */
export class HmrPreparationCleanupError extends AggregateError {
  constructor(failure: unknown, cleanupErrors: readonly unknown[]) {
    super([failure, ...cleanupErrors], 'HMR preparation failed and resource disposal failed', { cause: failure })
    this.name = 'HmrPreparationCleanupError'
  }
}
