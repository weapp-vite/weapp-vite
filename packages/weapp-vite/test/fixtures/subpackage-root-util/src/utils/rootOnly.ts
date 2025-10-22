export const ROOT_ONLY_SENTINEL = 'root-only-util'

export function buildRootOnlyMessage(origin: string) {
  return `${ROOT_ONLY_SENTINEL}:${origin}`
}
