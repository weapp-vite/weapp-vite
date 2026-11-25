import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('wevu', () => ({ reactive: <T extends object>(value: T) => value }))

async function loadShop(initial?: unknown) {
  let value = initial
  vi.stubGlobal('wx', {
    getStorageSync: () => value,
    setStorageSync: (_key: string, next: unknown) => {
      value = structuredClone(next)
    },
  })
  vi.resetModules()
  return import('../../../templates/weapp-vite-wevu-varo-retail-template/src/shop')
}

afterEach(() => vi.unstubAllGlobals())

describe('Varo retail template checkout', () => {
  it('keeps unselected cart lines and records each checkout only once', async () => {
    const retail = await loadShop()
    const { addProduct, products, shop, startCartCheckout, submitDemoOrder } = retail
    const [coffee, , drip] = products

    expect(addProduct(coffee.id, coffee.specs[1], 2)).toBe(true)
    expect(addProduct(drip.id, drip.specs[0], 1)).toBe(true)
    retail.setCartSelection(shop.cart[1].id, false)
    retail.selectAddress(retail.addresses[1].id)

    expect(startCartCheckout()).toBe(true)
    const order = submitDemoOrder()
    expect(order).toMatchObject({ addressId: retail.addresses[1].id, subtotal: 13600, shipping: 0, total: 13600, simulation: true })
    expect(order?.lines).toMatchObject([{ productId: coffee.id, spec: coffee.specs[1], quantity: 2 }])
    expect(shop.cart).toMatchObject([{ productId: drip.id, quantity: 1, selected: false }])
    expect(submitDemoOrder()).toBeUndefined()
    expect(shop.orders).toHaveLength(1)
  })

  it('does not consume the cart for a direct purchase and recovers the order on reload', async () => {
    const retail = await loadShop()
    const [coffee] = retail.products
    retail.addProduct(coffee.id, coffee.specs[0], 1)
    expect(retail.startDirectCheckout(coffee.id, coffee.specs[0], 1)).toBe(true)

    const order = retail.submitDemoOrder()
    expect(order).toMatchObject({ subtotal: 6800, shipping: 800, total: 7600 })
    vi.resetModules()
    const reloaded = await import('../../../templates/weapp-vite-wevu-varo-retail-template/src/shop')
    expect(reloaded.shop.cart).toHaveLength(1)
    expect(reloaded.shop.orders).toEqual([order])
    expect(reloaded.submitDemoOrder()).toBeUndefined()
  })

  it('starts clean when local storage cannot be read', async () => {
    const { products, shop, addProduct, startCartCheckout } = await loadShop('{')
    const [coffee] = products

    expect(shop.cart).toEqual([])
    expect(shop.orders).toEqual([])
    expect(startCartCheckout()).toBe(false)
    expect(addProduct(coffee.id, coffee.specs[0], coffee.stock + 1)).toBe(false)
  })
})
