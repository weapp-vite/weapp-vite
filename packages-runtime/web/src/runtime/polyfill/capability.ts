import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared'

const MINI_PROGRAM_CAPABILITY_SCHEMA_PREFIX_RE = new RegExp(`^(?:${getMiniProgramRuntimeGlobalKeys().join('|')})\\.`)

export function checkRuntimeCapability(
  miniProgramBridge: Record<string, unknown> | undefined,
  schema: string,
) {
  const normalized = String(schema ?? '').trim().replace(MINI_PROGRAM_CAPABILITY_SCHEMA_PREFIX_RE, '')
  if (!normalized) {
    return false
  }
  const path = normalized.split(/[.[\]]/g).filter(Boolean)
  if (!path.length) {
    return false
  }
  let cursor: unknown = miniProgramBridge
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') {
      return false
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return typeof cursor === 'function' || (typeof cursor === 'object' && cursor !== null)
}
