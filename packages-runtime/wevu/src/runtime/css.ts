import type { ComputedRef } from '../reactivity'
import { WEVU_CSS_MODULES_KEY, WEVU_CSS_VARS_STYLE_KEY } from '@weapp-core/constants'
import { computed, unref } from '../reactivity'
import { assertInSetup } from './hooks/base'

function stringifyCssVars(values: Record<string, unknown>) {
  return Object.entries(values)
    .map(([key, value]) => `--${key}:${value == null ? '' : String(unref(value as any))}`)
    .join(';')
}

/**
 * 读取当前 SFC 的 CSS Modules 映射。
 */
export function useCssModule(name = '$style'): Record<string, string> {
  const instance = assertInSetup('useCssModule') as Record<string, any>
  const modules = instance[WEVU_CSS_MODULES_KEY]
  const resolved = modules?.[name]
  if (!resolved || typeof resolved !== 'object') {
    throw new Error(`useCssModule() 找不到名为 ${JSON.stringify(name)} 的 CSS Module`)
  }
  return resolved
}

/**
 * 注册编译器生成的响应式 CSS 变量。
 * @internal
 */
export function useCssVars(getter: (context: Record<string, any>) => Record<string, unknown>): ComputedRef<string> {
  const instance = assertInSetup('useCssVars') as Record<string, any>
  const runtime = instance.__wevu
  const style = computed(() => stringifyCssVars(getter(runtime?.proxy ?? instance)))
  if (runtime?.state && typeof runtime.state === 'object') {
    runtime.state[WEVU_CSS_VARS_STYLE_KEY] = style
  }
  if (runtime?.setupState && typeof runtime.setupState === 'object') {
    runtime.setupState[WEVU_CSS_VARS_STYLE_KEY] = style
  }
  return style
}
