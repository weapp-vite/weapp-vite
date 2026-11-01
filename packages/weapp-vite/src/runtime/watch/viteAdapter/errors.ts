import { deduplicateCleanupErrors } from '../../watcher/cleanupErrors'

export function throwViteAdapterErrors(errors: unknown[]) {
  const unique = deduplicateCleanupErrors(errors)
  if (unique.length) {
    throw unique.length === 1 ? unique[0] : new AggregateError(unique, 'Vite watcher acquisition and cleanup failed', { cause: unique[0] })
  }
}
