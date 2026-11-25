import type { CartLine, Order, Product, ShopState } from './types'
import { reactive } from 'wevu'
import { addresses, categories, getProduct, hasAddress, products } from './catalog'
import { copyLine, lineId, persistState, readState } from './storage'

export type {
  Address,
  CartLine,
  Order,
  Product,
  ProductCategory,
  ShopCategory,
  ShopState,
} from './types'
export { addresses, categories, getProduct, products }

const FREE_SHIPPING_THRESHOLD = 9900
const STANDARD_SHIPPING = 800

export const shop = reactive<ShopState>(readState())

function save(): void {
  persistState(shop)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isLineAvailable(line: CartLine): boolean {
  const product = getProduct(line.productId)
  return Boolean(
    product
    && product.specs.includes(line.spec)
    && isPositiveInteger(line.quantity)
    && line.quantity <= product.stock,
  )
}

function quantityForProduct(lines: CartLine[], productId: string, exceptId?: string): number {
  return lines.reduce(
    (total, line) => total + (line.productId === productId && line.id !== exceptId ? line.quantity : 0),
    0,
  )
}

function areLinesAvailable(lines: CartLine[]): boolean {
  if (!lines.every(isLineAvailable)) {
    return false
  }
  return products.every(product => quantityForProduct(lines, product.id) <= product.stock)
}

/** 根据标识读取已创建的模拟订单。 */
export function getOrder(id: string): Order | undefined {
  return shop.orders.find(order => order.id === id)
}

/** 按分类和关键词查询演示商品。 */
export function queryProducts(category: string, keyword: string): Product[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  return products.filter((product) => {
    const inCategory = category === '全部' || product.category === category
    const searchable = `${product.title} ${product.category} ${product.hint} ${product.description}`.toLocaleLowerCase()
    return inCategory && (!normalizedKeyword || searchable.includes(normalizedKeyword))
  })
}

/** 计算商品行小计，金额单位为分。 */
export function subtotal(lines: CartLine[]): number {
  return lines.reduce((total, line) => {
    const product = getProduct(line.productId)
    return total + (product ? product.price * line.quantity : 0)
  }, 0)
}

/** 根据商品小计计算运费，满 99 元免运费。 */
export function shippingFor(subtotalInCents: number): number {
  if (!Number.isFinite(subtotalInCents) || subtotalInCents <= 0 || subtotalInCents >= FREE_SHIPPING_THRESHOLD) {
    return 0
  }
  return STANDARD_SHIPPING
}

/** 将以分为单位的金额格式化为人民币文本。 */
export function formatPrice(cents: number): string {
  const safeCents = Number.isSafeInteger(cents) ? cents : 0
  const sign = safeCents < 0 ? '-' : ''
  const amount = Math.abs(safeCents)
  const yuan = Math.floor(amount / 100)
  const fraction = amount % 100
  return `${sign}¥${fraction === 0 ? yuan : `${yuan}.${String(fraction).padStart(2, '0')}`}`
}

/** 将指定规格和数量加入购物车。 */
export function addProduct(productId: string, spec: string, quantity: number): boolean {
  const product = getProduct(productId)
  if (!product || !product.specs.includes(spec) || !isPositiveInteger(quantity)) {
    return false
  }

  const id = lineId(productId, spec)
  const existing = shop.cart.find(line => line.id === id)
  if (quantityForProduct(shop.cart, productId) + quantity > product.stock) {
    return false
  }

  if (existing) {
    existing.quantity += quantity
    existing.selected = true
  }
  else {
    shop.cart.push({ id, productId, spec, quantity, selected: true })
  }
  save()
  return true
}

/** 更新购物车行数量，数量必须在库存范围内。 */
export function setCartQuantity(id: string, quantity: number): boolean {
  const line = shop.cart.find(item => item.id === id)
  const product = line && getProduct(line.productId)
  if (
    !line
    || !product
    || !isPositiveInteger(quantity)
    || quantityForProduct(shop.cart, line.productId, line.id) + quantity > product.stock
  ) {
    return false
  }
  line.quantity = quantity
  save()
  return true
}

/** 更新购物车行的结算选中状态。 */
export function setCartSelection(id: string, selected: boolean): void {
  const line = shop.cart.find(item => item.id === id)
  if (!line) {
    return
  }
  line.selected = selected
  save()
}

/** 删除指定购物车行。 */
export function removeCartLine(id: string): void {
  const index = shop.cart.findIndex(line => line.id === id)
  if (index < 0) {
    return
  }
  shop.cart.splice(index, 1)
  save()
}

/** 使用当前选中的购物车行开始结算。 */
export function startCartCheckout(): boolean {
  const selected = shop.cart.filter(line => line.selected)
  if (selected.length === 0 || !areLinesAvailable(selected)) {
    return false
  }
  shop.checkoutLines = selected.map(copyLine)
  shop.checkoutKind = 'cart'
  save()
  return true
}

/** 使用单个商品直接开始结算。 */
export function startDirectCheckout(productId: string, spec: string, quantity: number): boolean {
  const product = getProduct(productId)
  if (!product || !product.specs.includes(spec) || !isPositiveInteger(quantity) || quantity > product.stock) {
    return false
  }
  shop.checkoutLines = [{
    id: lineId(productId, spec),
    productId,
    spec,
    quantity,
    selected: true,
  }]
  shop.checkoutKind = 'buy'
  save()
  return true
}

/** 选择模板内置的演示收货地址。 */
export function selectAddress(id: string): void {
  if (!hasAddress(id) || shop.addressId === id) {
    return
  }
  shop.addressId = id
  save()
}

/** 提交本地模拟订单；同一结算会话只会成功一次。 */
export function submitDemoOrder(): Order | undefined {
  if (!shop.checkoutKind || shop.checkoutLines.length === 0 || !areLinesAvailable(shop.checkoutLines)) {
    return undefined
  }

  const lines = shop.checkoutLines.map(copyLine)
  const orderSubtotal = subtotal(lines)
  const shipping = shippingFor(orderSubtotal)
  const createdAt = Date.now()
  const order: Order = {
    id: `DEMO-${createdAt}-${shop.orders.length + 1}`,
    addressId: shop.addressId,
    lines,
    subtotal: orderSubtotal,
    shipping,
    total: orderSubtotal + shipping,
    createdAt,
    simulation: true,
  }

  shop.orders.unshift(order)
  if (shop.checkoutKind === 'cart') {
    const submittedIds = new Set(lines.map(line => line.id))
    for (let index = shop.cart.length - 1; index >= 0; index -= 1) {
      if (submittedIds.has(shop.cart[index].id)) {
        shop.cart.splice(index, 1)
      }
    }
  }
  shop.checkoutLines = []
  shop.checkoutKind = null
  save()
  return order
}
