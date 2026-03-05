import { useBaseTag } from '../base'

export const COMPLEX_B_MATH_MARKER = '__SP_COMPLEX_B_MATH__'

export function useMathTag() {
  return `${COMPLEX_B_MATH_MARKER}:${useBaseTag()}`
}
