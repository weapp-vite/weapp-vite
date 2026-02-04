import { components } from './builtin.auto'

/**
 * 内置组件集合（来自自动生成的组件列表）。
 */
export const builtinComponentsSet = new Set(components)

/**
 * 判断标签是否为内置组件。
 */
export function isBuiltinComponent(tag: string) {
  return builtinComponentsSet.has(tag)
}
