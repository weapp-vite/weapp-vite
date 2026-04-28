export const SHARED_TOKEN = 'SHARED_TOKEN_MARKER'

export function createSharedLabel(source: string) {
  return `${source}:${SHARED_TOKEN}`
}
