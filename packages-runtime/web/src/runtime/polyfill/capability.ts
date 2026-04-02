export function checkRuntimeCapability(
  wxBridge: Record<string, unknown> | undefined,
  schema: string,
) {
  const normalized = String(schema ?? '').trim().replace(/^wx\./, '')
  if (!normalized) {
    return false
  }
  const path = normalized.split(/[.[\]]/g).filter(Boolean)
  if (!path.length) {
    return false
  }
  let cursor: unknown = wxBridge
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') {
      return false
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return typeof cursor === 'function' || (typeof cursor === 'object' && cursor !== null)
}
