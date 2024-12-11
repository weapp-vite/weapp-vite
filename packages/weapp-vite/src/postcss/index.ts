import postcss from 'postcss'
import { cssAtRulePrefix } from '../constants'
import { postCreator } from './post'

export async function cssPostProcess(code: string) {
  if (!code.includes(`@${cssAtRulePrefix}-`)) {
    return code
  }
  const { css } = await postcss([postCreator()]).process(code).async()
  return css
}
