import { useCoreTag } from './core'

export const COMPLEX_A_TRANSITIVE_MARKER = '__SP_COMPLEX_A_TRANSITIVE__'

export function useTransitiveTag() {
  return `${COMPLEX_A_TRANSITIVE_MARKER}:${useCoreTag()}`
}
