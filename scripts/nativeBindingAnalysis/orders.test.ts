import { describe, expect, it } from 'vitest'
import { balancedOrders } from './orders'

describe('paired variant ordering', () => {
  it.each([4, 5])('balances positions and preceding implementations for %i variants', (count) => {
    const variants = Array.from({ length: count }, (_, index) => `variant-${index}`)
    const orders = balancedOrders(variants)
    const frequency = count % 2 ? 2 : 1
    const preceding = new Map<string, number>()
    for (const order of orders) {
      expect([...order].sort()).toEqual(variants)
      order.slice(1).forEach((variant, index) => {
        const key = `${order[index]}:${variant}`
        preceding.set(key, (preceding.get(key) ?? 0) + 1)
      })
    }
    for (const variant of variants) {
      for (let position = 0; position < count; position++) {
        expect(orders.filter(order => order[position] === variant)).toHaveLength(frequency)
      }
      for (const previous of variants.filter(other => other !== variant)) {
        expect(preceding.get(`${previous}:${variant}`)).toBe(frequency)
      }
    }
  })

  it('rejects missing or duplicate comparison variants', () => {
    expect(() => balancedOrders([])).toThrow()
    expect(() => balancedOrders(['js', 'js'])).toThrow()
  })
})
