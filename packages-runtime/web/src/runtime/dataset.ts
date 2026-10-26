/** DOM 属性用于字符串查询，运行时 dataset 保留完整绑定表达式的值类型。 */
const runtimeDatasetValues = new WeakMap<Element, Map<string, unknown>>()

/** 只转换连字符后的 ASCII 小写字母，与 DOMStringMap 和小程序命名规则一致。 */
export function toDatasetKey(attributeName: string) {
  return attributeName.slice(5).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

/** 保存本次绑定值，包括数字、布尔值及 null / undefined。 */
export function storeRuntimeDataset(element: Element, attributeName: string, value: unknown) {
  const values = runtimeDatasetValues.get(element) ?? new Map<string, unknown>()
  values.set(attributeName, value)
  runtimeDatasetValues.set(element, values)
}

/** 释放指定绑定，不影响同一元素上其他拥有者的值。 */
export function clearRuntimeDataset(element: Element, attributeName: string) {
  const values = runtimeDatasetValues.get(element)
  values?.delete(attributeName)
  if (values?.size === 0) {
    runtimeDatasetValues.delete(element)
  }
}

/** 返回独立的 dataset 容器，对象和数组仍使用当前 Web 绑定值。 */
export function readRuntimeDataset(element: Element | null | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = { ...(element as HTMLElement | null | undefined)?.dataset }
  const values = element ? runtimeDatasetValues.get(element) : undefined
  if (element && values) {
    for (const [attributeName, value] of values) {
      // 显式 DOM 修改优先，避免旁路值遮蔽业务直接更新或移除的属性。
      if (element.getAttribute(attributeName) !== String(value ?? '')) {
        clearRuntimeDataset(element, attributeName)
        continue
      }
      Object.defineProperty(result, toDatasetKey(attributeName), {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      })
    }
  }
  return result
}
