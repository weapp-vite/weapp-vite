import type { GenerateType } from '../generator'
import { DEFAULT_JS_TEMPLATES } from '../constants'

export function generateJs(type?: GenerateType) {
  const key: GenerateType = type ?? 'component'
  return DEFAULT_JS_TEMPLATES[key]
}
