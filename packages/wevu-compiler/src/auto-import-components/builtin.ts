import { components } from './builtin.auto'

export const builtinComponentsSet = new Set(components)

export function isBuiltinComponent(tag: string) {
  return builtinComponentsSet.has(tag)
}
