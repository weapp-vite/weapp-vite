import type { HeadlessComponentDefinition, HeadlessComponentInstance } from './types'
import { runComponentObservers } from './observers'
import { normalizeComponentPropertyValue } from './properties'
import { cloneValue, hasComponentPropertyValueChanged } from './shared'

const consumedPageChanges = new WeakMap<HeadlessComponentInstance, string[]>()

export function syncComponentProperties(
  instance: HeadlessComponentInstance,
  definition: HeadlessComponentDefinition,
  nextProperties: Record<string, any>,
  bindingExpressions: Record<string, string | undefined>,
  changedPageKeys: string[],
  beforeObservers?: (instance: HeadlessComponentInstance, phase: 'properties') => void,
) {
  const freshPageChanges = changedPageKeys.length > 0 && consumedPageChanges.get(instance) !== changedPageKeys
  if (freshPageChanges) {
    // 先消费父级本次写入，observer 重入时不能再次覆盖组件对属性的修正。
    consumedPageChanges.set(instance, changedPageKeys)
  }
  const changedRootKeys: string[] = []
  const previousProperties: Record<string, any> = {}
  for (const [key, value] of Object.entries(nextProperties)) {
    const nextValue = normalizeComponentPropertyValue(definition, key, value)
    const bindingExpression = bindingExpressions[key]
    const bindingAffected = freshPageChanges && !!bindingExpression && changedPageKeys.some((changedKey) => {
      return changedKey === bindingExpression
        || changedKey.startsWith(`${bindingExpression}.`)
        || changedKey.startsWith(`${bindingExpression}[`)
    })
    const previousSnapshot = instance.__propertySnapshots?.[key]
    if (hasComponentPropertyValueChanged(instance.properties[key], previousSnapshot, nextValue, bindingAffected)) {
      previousProperties[key] = instance.properties[key]
      // 属性跨组件边界传递时必须隔离引用，否则父级深层 patch 会提前改写子级旧值。
      const deliveredValue = cloneValue(nextValue)
      instance.properties[key] = deliveredValue
      if (Object.hasOwn(definition.properties ?? {}, key)) {
        instance.data[key] = deliveredValue
      }
      changedRootKeys.push(key)
    }
    instance.__propertySnapshots ??= {}
    instance.__propertySnapshots[key] = cloneValue(nextValue)
  }

  if (changedRootKeys.length === 0) {
    return
  }

  beforeObservers?.(instance, 'properties')
  runComponentObservers(definition, instance, changedRootKeys, previousProperties)
}
