/**
 * 小程序允许 `data-*` 绑定任意值（对象、数组、数字），事件回调里通过
 * `event.currentTarget.dataset` 拿到的是原始引用。
 *
 * 浏览器 DOM 的 attribute 只能存字符串，Lit 会走 `setAttribute`，对象因此退化成
 * `"[object Object]"`，业务侧 `dataset.item.value` 直接变成 `undefined`。
 *
 * 这里把非原始值旁路存到 WeakMap，事件对象构造时再合并回来：
 * attribute 上只留空串，`dataset` 读到的仍是原对象。
 */
const objectDatasetValues = new WeakMap<Element, Record<string, unknown>>()

function isStorableValue(value: unknown) {
  return typeof value === 'object' && value !== null
}

/**
 * 把 `data-item-name` 归一化成 `itemName`，与浏览器 `DOMStringMap` 的规则一致。
 */
export function toDatasetKey(attributeName: string) {
  return attributeName
    .replace(/^data-/, '')
    .replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}

/**
 * 记录一个 `data-*` 的原始值。返回 `true` 表示该值已经旁路保存，
 * attribute 上应当留空，避免写入 `"[object Object]"`。
 */
export function storeRuntimeDataset(element: Element, attributeName: string, value: unknown) {
  if (!isStorableValue(value)) {
    const stored = objectDatasetValues.get(element)
    if (stored) {
      delete stored[toDatasetKey(attributeName)]
      if (Object.keys(stored).length === 0) {
        objectDatasetValues.delete(element)
      }
    }
    return false
  }
  const key = toDatasetKey(attributeName)
  const stored = objectDatasetValues.get(element) ?? {}
  stored[key] = value
  objectDatasetValues.set(element, stored)
  return true
}

/**
 * 读取元素的完整 dataset：原生字符串值 + 旁路保存的对象值。
 *
 * 返回新对象，调用方可以安全展开；没有对象值时退化为原生 `dataset`。
 */
export function readRuntimeDataset(element: Element | null | undefined) {
  const native = ((element as HTMLElement | null | undefined)?.dataset ?? {}) as Record<string, unknown>
  const stored = element ? objectDatasetValues.get(element) : undefined
  if (!stored) {
    return native
  }
  return { ...native, ...stored }
}
