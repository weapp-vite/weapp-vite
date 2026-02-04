import type { GenerateType } from '../generator'
import { DEFAULT_JS_TEMPLATES } from '../constants'

/**
 * @description 生成 JS 模板（app/page/component）
 */
export function generateJs(type?: GenerateType) {
  const key: GenerateType = type ?? 'component'
  return DEFAULT_JS_TEMPLATES[key]
}
