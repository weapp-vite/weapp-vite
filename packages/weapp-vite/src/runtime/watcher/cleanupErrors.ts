/** 聚合交叠只按原原因身份去重；保留独立错误、空聚合及未变动的诊断结构。 */
export function deduplicateCleanupErrors(errors: Iterable<unknown>): unknown[] {
  const seen = new Set<unknown>()
  function collect(error: unknown): unknown[] {
    if (seen.has(error)) {
      return []
    }
    seen.add(error)
    if (!(error instanceof AggregateError) || error.errors.length === 0) {
      return [error]
    }
    const original = error.errors as unknown[]
    const remaining = original.flatMap(collect)
    if (!remaining.length) {
      return []
    }
    if (remaining.length === original.length && remaining.every((cause, index) => cause === original[index])) {
      return [error]
    }
    const aggregate = new AggregateError(remaining, error.message, { cause: error.cause })
    aggregate.name = error.name
    aggregate.stack = error.stack
    return [aggregate]
  }
  return [...errors].flatMap(collect)
}
