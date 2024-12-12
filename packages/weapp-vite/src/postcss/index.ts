import type { CssPostProcessOptions } from './types'
import postcss from 'postcss'
import { cssAtRulePrefix, IFDEF, IFNDEF } from './constants'
import { postCreator } from './post'

export async function cssPostProcess(code: string, options: CssPostProcessOptions) {
  if (new RegExp(`@${cssAtRulePrefix}-|${IFDEF}|${IFNDEF}`).test(code)) {
    const { css } = await postcss([postCreator(options)]).process(code).async()
    return css
  }
  return code
}
