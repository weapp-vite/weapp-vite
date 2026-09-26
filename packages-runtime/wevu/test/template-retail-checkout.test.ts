import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { RETAIL_CHECKOUT_GOODS } from '../../../e2e/utils/templateAcceptance/retailCheckout'
import { genSettleDetail } from '../../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/model/order/orderConfirm'

const goods = RETAIL_CHECKOUT_GOODS

function createCheckout(data = genSettleDetail({ goodsRequestList: goods }).data) {
  const filename = fileURLToPath(new URL('../../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/order/order-confirm/index.vue', import.meta.url))
  const source = parse(readFileSync(filename, 'utf8'), { filename }).descriptor.scriptSetup!.content
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const script = ast.statements.filter(statement => !ts.isImportDeclaration(statement)).map(statement => statement.getText(ast)).join('\n')
  const showToast = vi.fn()
  const schedule = vi.fn()
  const fetchSettleDetail = vi.fn(async () => ({ data }))
  const code = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText
  const page = runInNewContext(`${code}\n({ handleOptionsParams, initData, isInvalidOrder, onSureCommit, loading, popupShow, settleDetailData, orderCardList })`, {
    ref: (value: unknown) => ({ value }),
    computed: (read: () => unknown) => ({ get value() { return read() } }),
    onLoad() {},
    onShow() {},
    definePageJson() {},
    wpi: { getStorageSync: () => JSON.stringify(goods) },
    fetchSettleDetail,
    showToast,
    setTimeout: schedule,
  })
  return { page, showToast, schedule, fetchSettleDetail }
}

describe('retail checkout settlement', () => {
  it('initializes a successful settlement with nullable exceptional goods lists without error navigation', async () => {
    const { page, showToast, schedule } = createCheckout()
    await page.handleOptionsParams({ type: 'cart' })

    expect(showToast).not.toHaveBeenCalled()
    expect(schedule).not.toHaveBeenCalled()
    expect(page.loading.value).toBe(false)
    expect(page.popupShow.value).toBe(false)
    expect(page.orderCardList.value[0].goodsList[0]).toMatchObject({ title: '测试商品', price: '12900', num: 1 })
    expect(page.settleDetailData.value.totalPayAmount).toBe('11800')
    expect(page.settleDetailData.value.totalGoodsCount).toBe(1)
  })

  it.each(['limitGoodsList', 'abnormalDeliveryGoodsList', 'inValidGoodsList'])('still blocks a real nonempty %s and clears the popup for an eligible order', (key) => {
    const { page } = createCheckout()
    const data = genSettleDetail({ goodsRequestList: goods, userAddressReq: { name: '收货人' } }).data
    expect(page.isInvalidOrder({ ...data, [key]: [{ skuId: 'blocked' }] })).toBe(true)
    expect(page.popupShow.value).toBe(true)
    expect(page.isInvalidOrder(data)).toBe(false)
    expect(page.popupShow.value).toBe(false)
    expect(page.isInvalidOrder({ ...data, settleType: 0 })).toBe(true)
  })

  it('does not retry settlement for nullable stock and invalid-goods lists', async () => {
    const { page, fetchSettleDetail } = createCheckout()
    await page.handleOptionsParams({ type: 'cart' })
    await page.onSureCommit()
    expect(fetchSettleDetail).toHaveBeenCalledTimes(1)
  })

  it('derives checkout quantities and finite amounts from the actual cart fixture', () => {
    const result = genSettleDetail({ goodsRequestList: [{ ...goods[0], quantity: 2 }] })
    expect(result.data.totalGoodsCount).toBe(2)
    expect(result.data.totalSalePrice).toBe('25800')
    expect(result.data.totalPayAmount).toBe('24700')
    expect(result.data.storeGoodsList[0].skuDetailVos[0]).toMatchObject({
      goodsName: '测试商品',
      quantity: 2,
      settlePrice: '12900',
      skuSpecLst: [{ specValue: '白色' }],
    })
  })
})
