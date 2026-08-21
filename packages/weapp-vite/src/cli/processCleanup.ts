import type { ChildProcess } from 'node:child_process'
import process from 'node:process'

function isSassEmbeddedChild(handle: unknown): handle is ChildProcess {
  if (!handle || typeof handle !== 'object') {
    return false
  }
  const child = handle as Partial<ChildProcess> & { spawnargs?: string[] }
  const spawnfile = typeof child.spawnfile === 'string' ? child.spawnfile : ''
  const spawnargs = Array.isArray(child.spawnargs) ? child.spawnargs : []
  return Boolean(
    'kill' in handle
    && 'spawnfile' in handle
    && (
      spawnfile.includes('sass-embedded')
      || (spawnfile.includes('dart-sass') && spawnargs.includes('--embedded'))
    ),
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
