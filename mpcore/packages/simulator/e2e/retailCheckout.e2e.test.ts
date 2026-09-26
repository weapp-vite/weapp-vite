import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { retailCheckoutFiles, retailSettlement } from '../test/helpers/retailCheckout'

it('renders nullable retail settlement components and refreshed quantities in the browser', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(retailCheckoutFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    session.bootstrap()
    const app = session.getApp()
    if (!app) {
      throw new Error('Checkout fixture app did not bootstrap')
    }
    for (const scenario of [
      { quantity: 1, quantityText: '共1件', goodsText: 'x1', amountText: '11800' },
      { quantity: 2, quantityText: '共2件', goodsText: 'x2', amountText: '24700' },
      { quantity: 1, quantityText: '共1件', goodsText: 'x1', amountText: '11800' },
    ]) {
      app.cacheSettlement(retailSettlement(scenario.quantity))
      session.reLaunch('/pages/checkout/index')
      await expect.poll(() => {
        preview.innerHTML = session.renderCurrentPage().wxml
        return preview.querySelector('#available')?.textContent
      }).toBe('提交订单')
      expect(preview.querySelectorAll('.goods-title')).toHaveLength(1)
      expect(preview.querySelector('.goods-title')?.textContent).toBe('测试商品')
      expect(preview.querySelector('.goods-count')?.textContent).toBe(scenario.goodsText)
      expect(preview.querySelector('.goods-price')?.textContent).toBe('12900')
      expect(preview.querySelector('#quantity')?.textContent).toBe(scenario.quantityText)
      expect(preview.querySelector('#amount')?.textContent).toBe(scenario.amountText)
      expect(preview.querySelectorAll('#loading, #blocked')).toHaveLength(0)
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
