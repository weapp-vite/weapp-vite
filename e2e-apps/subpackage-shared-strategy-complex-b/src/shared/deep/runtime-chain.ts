import { useBaseTag } from '../base'
import { useClusterTag } from '../sub-cluster'
import { useMathTag } from './math'

export const COMPLEX_B_RUNTIME_CHAIN_MARKER = '__SP_COMPLEX_B_RUNTIME_CHAIN__'

export function useRuntimeChainTag() {
  return `${COMPLEX_B_RUNTIME_CHAIN_MARKER}:${useBaseTag()}:${useClusterTag()}:${useMathTag()}`
}
