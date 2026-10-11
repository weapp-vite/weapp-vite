const LOOP_SCOPE_ESCAPE_RE = /[^\w-]/g

function escapeScopeCodeUnit(character: string) {
  return `~${character.charCodeAt(0).toString(16).padStart(4, '0')}`
}

function encodeLoopCoordinate(value: string) {
  // 按 UTF-16 码元无损转义：既隔离路径分隔符，也保留合法 JSON 中未配对的代理项。
  return value.replace(LOOP_SCOPE_ESCAPE_RE, escapeScopeCodeUnit)
}

export function resolveLoopEntries(value: unknown): Array<[string | number, unknown]> {
  if (Array.isArray(value)) {
    return value.map((item, index) => [index, item])
  }
  return value !== null && typeof value === 'object' ? Object.entries(value) : []
}

export function resolveLoopInstanceSuffix(item: unknown, index: string | number, key: string | undefined, occurrences?: Map<string, number>) {
  if (!key || !occurrences) {
    return `:for-${encodeLoopCoordinate(String(index))}`
  }
  // JS 属性读取允许基本值装箱；可选链处理 null/undefined，不需要复制 loop item。
  const keyedItem = item as Record<string, unknown> | null | undefined
  const value = key === '*this' ? item : keyedItem?.[key]
  const normalized = encodeLoopCoordinate(String(value ?? ''))
  const occurrence = occurrences.get(normalized) ?? 0
  occurrences.set(normalized, occurrence + 1)
  // 无效的重复 key 也不能让两个声明共享同一个实例。
  return `:key-${normalized}${occurrence ? `:duplicate-${occurrence}` : ''}`
}
