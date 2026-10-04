export interface SequenceErrorEvidence {
  name?: string
  message: string
  stack?: string
  cause?: SequenceErrorEvidence
  errors?: SequenceErrorEvidence[]
}

/** 保留跨 worker 和报告边界的完整错误链，并将循环引用转换为明确诊断。 */
export function serializeSequenceError(error: unknown, ancestors = new Set<Error>()): SequenceErrorEvidence {
  if (!(error instanceof Error)) {
    return { message: String(error) }
  }
  if (ancestors.has(error)) {
    return { name: error.name, message: '[Circular error reference]' }
  }
  const nextAncestors = new Set(ancestors).add(error)
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...('cause' in error ? { cause: serializeSequenceError(error.cause, nextAncestors) } : {}),
    ...(error instanceof AggregateError ? { errors: error.errors.map(item => serializeSequenceError(item, nextAncestors)) } : {}),
  }
}

/** 还原 IPC 中的错误结构，使外层上下文包装仍能保留原始 cause 和聚合错误。 */
export function restoreSequenceError(evidence: SequenceErrorEvidence): Error {
  const options = evidence.cause ? { cause: restoreSequenceError(evidence.cause) } : undefined
  const error = evidence.errors
    ? new AggregateError(evidence.errors.map(restoreSequenceError), evidence.message, options)
    : new Error(evidence.message, options)
  if (evidence.name) {
    error.name = evidence.name
  }
  if (evidence.stack) {
    error.stack = evidence.stack
  }
  return error
}
