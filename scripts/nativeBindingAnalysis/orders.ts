/** 每个周期内平衡实现的执行位置与相邻前序，降低顺序和上一实现的 GC 影响。 */
export function balancedOrders<T>(variants: readonly T[]): T[][] {
  if (variants.length < 2 || new Set(variants).size !== variants.length) {
    throw new Error('Expected at least two distinct variants')
  }
  const count = variants.length
  const indices = Array.from({ length: count }, (_, index) => index % 2 ? (index + 1) / 2 : count - index / 2)
  indices[0] = 0
  const orders = variants.map((_, offset) => indices.map(index => variants[(index + offset) % count]!))
  return count % 2 ? [...orders, ...orders.map(order => [...order].reverse())] : orders
}
