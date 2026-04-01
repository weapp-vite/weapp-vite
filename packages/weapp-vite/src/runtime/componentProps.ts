import type { AstEngineName } from '../ast'
import { collectComponentPropsFromCode } from '../ast'

export type ComponentPropMap = Map<string, string>

/**
 * 提取组件 `properties/props` 的静态类型信息。
 */
export function extractComponentProps(
  code: string,
  options?: {
    astEngine?: AstEngineName
  },
): ComponentPropMap {
  return collectComponentPropsFromCode(code, options)
}
