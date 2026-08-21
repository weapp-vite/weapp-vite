import type { ChildProcess } from 'node:child_process'
import process from 'node:process'

function isSassEmbeddedChild(handle: unknown): handle is ChildProcess {
  return Boolean(
    handle
    && typeof handle === 'object'
    && 'kill' in handle
    && 'spawnfile' in handle
    && typeof (handle as ChildProcess).spawnfile === 'string'
    && (handle as ChildProcess).spawnfile?.includes('sass-embedded'),
  )
}

export function terminateStaleSassEmbeddedProcess() {
  const getHandles = (process as typeof process & { _getActiveHandles?: () => unknown[] })._getActiveHandles
  const handles = typeof getHandles === 'function' ? getHandles() : undefined
  if (!Array.isArray(handles)) {
    return
  }
  for (const handle of handles) {
    if (isSassEmbeddedChild(handle)) {
      try {
        handle.kill()
      }
      catch { }
    }
  }
}
