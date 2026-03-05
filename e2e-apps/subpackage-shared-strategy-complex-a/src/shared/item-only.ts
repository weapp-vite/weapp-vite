import { createColors } from 'picocolors'

export const COMPLEX_A_NPM_SINGLE_MARKER = '__SP_COMPLEX_A_NPM_SINGLE__'

const colors = createColors(false)

export function useItemOnlyNpmTag() {
  return colors.cyan(COMPLEX_A_NPM_SINGLE_MARKER)
}
