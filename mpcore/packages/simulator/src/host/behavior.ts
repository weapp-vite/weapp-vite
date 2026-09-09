import type { HeadlessComponentDefinition } from './globals'

export function validateConstructedBehaviors(definition: HeadlessComponentDefinition, visited = new WeakSet<object>()) {
  if (visited.has(definition)) {
    return
  }
  visited.add(definition)
  const behaviors: unknown[] = Array.isArray(definition.behaviors) ? definition.behaviors : []
  for (const behavior of behaviors) {
    // 内置 wx:// 行为沿用宿主字符串协议；这里只校验已由真实 IDE 确认无效的普通对象。
    if (!behavior || typeof behavior !== 'object' || Array.isArray(behavior)) {
      continue
    }
    if (!('__isHeadlessBehavior__' in behavior) || behavior.__isHeadlessBehavior__ !== true) {
      throw new Error('Behaviors should be constructed with Behavior()')
    }
    validateConstructedBehaviors(behavior, visited)
  }
}
