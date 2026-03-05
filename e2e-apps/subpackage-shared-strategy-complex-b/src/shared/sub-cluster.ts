import { createColors } from 'picocolors'

export const COMPLEX_B_CLUSTER_MARKER = '__SP_COMPLEX_B_CLUSTER__'
export const COMPLEX_B_NPM_SUB_ONLY_MARKER = '__SP_COMPLEX_B_NPM_SUB_ONLY__'

const colors = createColors(false)

export function useClusterTag() {
  return `${COMPLEX_B_CLUSTER_MARKER}:${colors.green(COMPLEX_B_NPM_SUB_ONLY_MARKER)}`
}
