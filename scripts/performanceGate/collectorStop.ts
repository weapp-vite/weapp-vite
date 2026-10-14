export interface CollectorStop {
  reason: 'cleanup-unconfirmed' | 'cancelled'
  resourcesReleased: boolean
  cancelled: boolean
}

/** 资源未终结或收到取消时，结构化保留首错与独立清理错误，禁止启动后续采集。 */
export class CollectorStopError extends AggregateError {
  readonly stop: CollectorStop

  constructor(firstError: Error, cleanupFailure: { error: unknown } | undefined, cancelled: boolean, message = firstError.message) {
    super(cleanupFailure ? [firstError, cleanupFailure.error] : [firstError], message, { cause: firstError })
    this.name = 'CollectorStopError'
    this.stop = { reason: cleanupFailure ? 'cleanup-unconfirmed' : 'cancelled', resourcesReleased: !cleanupFailure, cancelled }
  }
}

export function collectorStop(error: unknown): CollectorStop | undefined {
  return error instanceof CollectorStopError ? error.stop : undefined
}

export function isCollectorStop(value: unknown): value is CollectorStop {
  if (!value || typeof value !== 'object' || !('reason' in value) || !('resourcesReleased' in value) || !('cancelled' in value)) {
    return false
  }
  return value.reason === 'cleanup-unconfirmed'
    ? value.resourcesReleased === false && typeof value.cancelled === 'boolean'
    : value.reason === 'cancelled' && value.resourcesReleased === true && value.cancelled === true
}
