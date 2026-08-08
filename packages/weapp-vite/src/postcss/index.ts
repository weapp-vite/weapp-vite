import type { CssPostProcessOptions } from './types'
import postcss from 'postcss'
import { transformNestedWxssVars, transformVueDeepSelectors } from 'wevu/compiler'
import { cssAtRulePrefix, IFDEF, IFNDEF } from './constants'
import { postCreator } from './post'

const NEEDS_CONDITIONAL_PROCESS_RE = new RegExp(`@${cssAtRulePrefix}-|${IFDEF}|${IFNDEF}`)

export async function cssPostProcess(code: string, options: CssPostProcessOptions) {
  let processed = code
  if (NEEDS_CONDITIONAL_PROCESS_RE.test(processed)) {
    const result = await postcss([postCreator(options)]).process(processed, { from: undefined })
    processed = result.css
  }
  return options.platform === 'weapp'
    ? transformNestedWxssVars(transformVueDeepSelectors(processed))
    : processed
}
