import { createColors } from 'picocolors'

export const COMPLEX_B_NPM_SINGLE_MARKER = '__SP_COMPLEX_B_NPM_SINGLE__'

const colors = createColors(false)

export function useBetaOnlyNpmTag() {
  return colors.magenta(COMPLEX_B_NPM_SINGLE_MARKER)
}
