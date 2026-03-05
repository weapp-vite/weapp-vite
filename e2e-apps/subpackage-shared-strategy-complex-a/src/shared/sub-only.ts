import { createColors } from 'picocolors'

export const COMPLEX_A_SUB_ONLY_MARKER = '__SP_COMPLEX_A_SUB_ONLY__'
export const COMPLEX_A_NPM_SUB_ONLY_MARKER = '__SP_COMPLEX_A_NPM_SUB_ONLY__'

const colors = createColors(false)

export function useSubOnlyTag() {
  return `${COMPLEX_A_SUB_ONLY_MARKER}:${colors.bold(COMPLEX_A_NPM_SUB_ONLY_MARKER)}`
}
