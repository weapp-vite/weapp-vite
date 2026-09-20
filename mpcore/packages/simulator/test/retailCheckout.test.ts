import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectAll } from 'css-select'
import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { retailCheckoutFiles, retailSettlement } from './helpers/retailCheckout'

describe.each(['node', 'browser'] as const)('%s retail checkout host contract', (provider) => {
  it('renders asynchronously settled nullable lists and replaces item state after reLaunch', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-retail-checkout-'))
    for (const [relativePath, source] of retailCheckoutFiles) {
      const target = path.join(projectPath, relativePath)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(retailCheckoutFiles) })
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
        const settlement = retailSettlement(scenario.quantity)
        expect(settlement.inValidGoodsList).toBeNull()
        expect(settlement.outOfStockGoodsList).toBeNull()
        app.cacheSettlement(settlement)
        session.reLaunch('/pages/checkout/index')
        await expect.poll(() => session.renderCurrentPage().wxml).toContain('id="available"')
        const document = parseDocument(session.renderCurrentPage().wxml)
        const text = (selector: string) => {
          const nodes = selectAll(selector, document.children)
          expect(nodes).toHaveLength(1)
          const node = nodes[0]
          return node && 'children' in node ? node.children.map(child => 'data' in child ? child.data : '').join('') : undefined
        }
        expect(text('.goods-title')).toBe('测试商品')
        expect(text('.goods-count')).toBe(scenario.goodsText)
        expect(text('.goods-price')).toBe('12900')
        expect(text('#quantity')).toBe(scenario.quantityText)
        expect(text('#amount')).toBe(scenario.amountText)
        expect(text('#available')).toBe('提交订单')
        expect(selectAll('#blocked, #loading', document.children)).toHaveLength(0)
      }
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
