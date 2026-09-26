import type { HeadlessComponentDefinition, HeadlessComponentInstance } from './types'

function hasExportBehavior(definition: HeadlessComponentDefinition, visited = new Set<object>()): boolean {
  if (visited.has(definition)) {
    return false
  }
  visited.add(definition)
  const behaviors: unknown[] = Array.isArray(definition.behaviors) ? definition.behaviors : []
  return behaviors.some(behavior => behavior === 'wx://component-export'
    || (behavior !== null && typeof behavior === 'object'
      && hasExportBehavior(behavior as HeadlessComponentDefinition, visited)))
}

/** 原生选择器尊重组件导出行为；测试桥接继续保留完整组件实例。 */
export function resolveNativeComponentSelection(instance: HeadlessComponentInstance | null | undefined): any {
  if (!instance) {
    return null
  }
  const definition = instance.__definition__
  if (!definition || !hasExportBehavior(definition) || typeof instance.export !== 'function') {
    return instance
  }
  return instance.export()
}
