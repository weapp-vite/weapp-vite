import type { CssPostProcessOptions } from './types'
import postcss from 'postcss'
import { cssAtRulePrefix, IFDEF, IFNDEF } from './constants'
import { postCreator } from './post'

const NEEDS_PROCESS_RE = new RegExp(`@${cssAtRulePrefix}-|${IFDEF}|${IFNDEF}`)

export async function cssPostProcess(code: string, options: CssPostProcessOptions) {
  if (!NEEDS_PROCESS_RE.test(code)) {
    return code
  }
  const result = await postcss([postCreator(options)]).process(code, { from: undefined })
  return result.css
}
