/** 在测试 API 边界复制 JSON 数据，避免调用方引用进入 runtime。 */
export function serializeComponentData(value: Record<string, unknown>, label: string) {
  try {
    return JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') {
        throw new TypeError('Unsupported non-serializable value.')
      }
      return item
    })
  }
  catch (error) {
    throw new TypeError(`${label} must contain serializable data.`, { cause: error })
  }
}

export function cloneComponentData(value: Record<string, unknown>, label: string): Record<string, unknown> {
  return JSON.parse(serializeComponentData(value, label)) as Record<string, unknown>
}
