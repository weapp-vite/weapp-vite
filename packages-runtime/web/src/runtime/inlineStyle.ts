import type { ResolvedStyleUnitOptions } from '../shared/styleUnits/options'
import { normalizeStyle } from 'wevu/internal-template'
import { resolveStyleUnitOptions } from '../shared/styleUnits/options'
import { transformStyleValue } from '../shared/styleUnits/value'

let activeOptions = resolveStyleUnitOptions()

/** 配置由生成入口显式传入，与 WXSS 使用同一份已解析的单位选项。 */
export function configureInlineStyleUnits(options?: ResolvedStyleUnitOptions) {
  activeOptions = options ? { ...options } : resolveStyleUnitOptions()
}

/** 只转换 CSS 单位 token，不探测 DOM 变量或缓存视口尺寸。 */
export function transformInlineStyle(value: string) {
  return transformStyleValue(value, activeOptions)
}

/** 对象和数组复用模板样式归一化，其他值原样交给 Lit 保留空值和移除语义。 */
export function transformInlineStyleValue<Value extends string | object>(value: Value): string
export function transformInlineStyleValue<Value extends null | undefined | boolean | number | bigint | symbol>(value: Value): Value
export function transformInlineStyleValue(value: unknown): unknown
export function transformInlineStyleValue(value: unknown): unknown {
  if (typeof value === 'string' || (value !== null && typeof value === 'object')) {
    return transformInlineStyle(normalizeStyle(value))
  }
  return value
}
