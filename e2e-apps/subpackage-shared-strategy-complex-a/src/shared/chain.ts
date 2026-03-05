import { usePairOnlyTag } from './pair-only'
import { useSubOnlyTag } from './sub-only'

export const COMPLEX_A_CHAIN_MARKER = '__SP_COMPLEX_A_CHAIN__'

export function useChainTag() {
  return `${COMPLEX_A_CHAIN_MARKER}:${useSubOnlyTag()}:${usePairOnlyTag()}`
}
