import type { FileWatchChange } from './types'

export function createFileWatchEvents() {
  const changes = new Set<(changes: FileWatchChange[]) => void>()
  const errors = new Set<(error: unknown) => void>()
  let closed = false
  const report = (error: unknown) => {
    if (!closed) {
      for (const listener of errors) {
        listener(error)
      }
    }
  }
  return {
    onChange(listener: (batch: FileWatchChange[]) => void) {
      changes.add(listener)
      return () => {
        changes.delete(listener)
      }
    },
    onError(listener: (error: unknown) => void) {
      errors.add(listener)
      return () => {
        errors.delete(listener)
      }
    },
    emit(batch: FileWatchChange[]) {
      if (!closed && batch.length) {
        for (const listener of changes) {
          try {
            listener(batch)
          }
          catch (error) {
            report(error)
          }
        }
      }
    },
    report,
    close() {
      closed = true
      changes.clear()
      errors.clear()
    },
  }
}

export function throwFileWatchFailures(results: PromiseSettledResult<unknown>[]) {
  const failures = [...new Set(results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => result.reason))]
  if (failures.length) {
    throw failures.length === 1 ? failures[0] : new AggregateError(failures, 'File watcher cleanup failed', { cause: failures[0] })
  }
}
