import type { CartLine, Order, ShopState } from './types'
import { wpi } from 'wevu/api'
import { addresses, getProduct, hasAddress } from './catalog'

interface PersistedShopState extends ShopState {
  version: 1
}

const STORAGE_KEY = 'weapp-vite:varo-retail:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

export function lineId(productId: string, spec: string): string {
  return `${productId}:${spec}`
}

export function copyLine(line: CartLine): CartLine {
  return { ...line }
}

function normalizeLine(value: unknown): CartLine | undefined {
  if (!isRecord(value) || typeof value.productId !== 'string' || typeof value.spec !== 'string') {
    return undefined
  }

  const product = getProduct(value.productId)
  if (!product || !product.specs.includes(value.spec) || !isPositiveInteger(value.quantity)) {
    return undefined
  }

  return {
    id: lineId(product.id, value.spec),
    productId: product.id,
    spec: value.spec,
    quantity: Math.min(value.quantity, product.stock),
    selected: value.selected !== false,
  }
}

function normalizeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) {
    return []
  }

  const lines: CartLine[] = []
  for (const candidate of value) {
    const line = normalizeLine(candidate)
    if (!line) {
      continue
    }
    const existing = lines.find(item => item.id === line.id)
    const product = getProduct(line.productId)
    if (!product) {
      continue
    }
    const allocatedByOtherSpecs = lines.reduce(
      (total, item) => total + (item.productId === line.productId && item.id !== line.id ? item.quantity : 0),
      0,
    )
    const availableForSpec = product.stock - allocatedByOtherSpecs
    if (existing) {
      existing.quantity = Math.min(existing.quantity + line.quantity, availableForSpec)
      existing.selected = existing.selected || line.selected
    }
    else if (availableForSpec > 0) {
      line.quantity = Math.min(line.quantity, availableForSpec)
      lines.push(line)
    }
  }
  return lines
}

function normalizeOrder(value: unknown): Order | undefined {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.addressId !== 'string'
    || !hasAddress(value.addressId)
    || !isSafeInteger(value.subtotal)
    || !isSafeInteger(value.shipping)
    || !isSafeInteger(value.total)
    || !isSafeInteger(value.createdAt)
    || value.simulation !== true
  ) {
    return undefined
  }

  const lines = normalizeLines(value.lines)
  if (lines.length === 0 || value.subtotal < 0 || value.shipping < 0 || value.total !== value.subtotal + value.shipping) {
    return undefined
  }

  return {
    id: value.id,
    addressId: value.addressId,
    lines,
    subtotal: value.subtotal,
    shipping: value.shipping,
    total: value.total,
    createdAt: value.createdAt,
    simulation: true,
  }
}

function emptyState(): ShopState {
  return {
    cart: [],
    orders: [],
    addressId: addresses[0].id,
    checkoutLines: [],
    checkoutKind: null,
  }
}

function normalizeState(value: unknown): ShopState {
  if (!isRecord(value)) {
    return emptyState()
  }

  const checkoutKind = value.checkoutKind === 'cart' || value.checkoutKind === 'buy'
    ? value.checkoutKind
    : null
  const checkoutLines = checkoutKind ? normalizeLines(value.checkoutLines) : []
  const orders = Array.isArray(value.orders)
    ? value.orders.map(normalizeOrder).filter((order): order is Order => order !== undefined)
    : []

  return {
    cart: normalizeLines(value.cart),
    orders,
    addressId: typeof value.addressId === 'string' && hasAddress(value.addressId)
      ? value.addressId
      : addresses[0].id,
    checkoutLines: checkoutLines.length > 0 ? checkoutLines : [],
    checkoutKind: checkoutLines.length > 0 ? checkoutKind : null,
  }
}

/** 从本地缓存恢复商店状态，异常缓存会回退为空状态。 */
export function readState(): ShopState {
  try {
    const stored: unknown = wpi.getStorageSync(STORAGE_KEY)
    if (stored === '' || stored === null || stored === undefined) {
      return emptyState()
    }
    return normalizeState(typeof stored === 'string' ? JSON.parse(stored) as unknown : stored)
  }
  catch {
    return emptyState()
  }
}

/** 将当前商店状态写入本地缓存。 */
export function persistState(shop: ShopState): void {
  const persisted: PersistedShopState = {
    version: 1,
    cart: shop.cart.map(copyLine),
    orders: shop.orders.map(order => ({
      ...order,
      lines: order.lines.map(copyLine),
    })),
    addressId: shop.addressId,
    checkoutLines: shop.checkoutLines.map(copyLine),
    checkoutKind: shop.checkoutKind,
  }
  try {
    wpi.setStorageSync(STORAGE_KEY, persisted)
  }
  catch {
    // 存储空间不可用时仍保留当前会话内的示例状态。
  }
}
