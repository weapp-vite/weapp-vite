export function cloneDataModelValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const result: unknown[] = []
    result.length = value.length
    for (let index = 0; index < value.length; index++) {
      if (index in value) {
        result[index] = cloneDataModelValue(value[index])
      }
    }
    return result
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      Object.defineProperty(result, key, {
        value: cloneDataModelValue(item),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return result
  }
  return value
}

export function selectOperation<T>(
  operations: ReadonlyMap<string, T>,
  name: string | undefined,
  kind: 'binding' | 'action',
  nodeId: string,
): T | undefined {
  if (name !== undefined) {
    const selected = operations.get(name)
    if (!selected) {
      throw new TypeError(`节点 '${nodeId}' 不存在名为 '${name}' 的${kind === 'binding' ? '输入绑定' : '动作'}。`)
    }
    return selected
  }
  if (operations.size === 1) {
    return operations.values().next().value
  }
  if (operations.size > 1) {
    throw new TypeError(`节点 '${nodeId}' 有多个${kind === 'binding' ? '输入绑定' : '动作'}，请指定${kind === 'binding' ? ' bindingName' : ' actionName'}。`)
  }
  return undefined
}
