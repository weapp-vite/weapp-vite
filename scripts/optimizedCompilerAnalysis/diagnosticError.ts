export interface DiagnosticError {
  name: string
  message: string
  cause?: DiagnosticError
  errors?: DiagnosticError[]
}

/** 保留主错误、聚合错误与嵌套原因；仅截断当前递归路径上的循环引用。 */
export function serializeDiagnosticError(cause: unknown): DiagnosticError {
  const active = new WeakSet<object>()
  const visit = (value: unknown): DiagnosticError => {
    if (!value || typeof value !== 'object') {
      return { name: 'Error', message: String(value) }
    }
    if (active.has(value)) {
      return { name: 'CircularError', message: 'Circular error reference' }
    }
    active.add(value)
    try {
      const record = value as Record<string, unknown>
      const result: DiagnosticError = {
        name: typeof record.name === 'string' ? record.name : 'Error',
        message: typeof record.message === 'string' ? record.message : String(value),
      }
      if (record.cause !== undefined) {
        result.cause = visit(record.cause)
      }
      if (Array.isArray(record.errors)) {
        result.errors = record.errors.map(visit)
      }
      return result
    }
    finally {
      active.delete(value)
    }
  }
  return visit(cause)
}
