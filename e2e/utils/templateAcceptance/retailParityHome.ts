interface RetailHomeGoods {
  originPrice: number
  price: number
  spuId: string
  tags: string[]
  thumb: string
  title: string
}

interface RetailHomePage {
  data: (key: string) => Promise<unknown>
  setData: (data: Record<string, unknown>) => Promise<void>
  getElementsByXpath: (selector: string, options: { fallback: false, timeout: number }) => Promise<Array<{ text: () => Promise<string> }>>
  waitFor: (time: number) => Promise<void>
}

const HOME_TITLES = [
  '白色短袖连衣裙荷叶边裙摆宽松韩版休闲纯白清爽优雅连衣裙',
  '回归商品二',
  '回归商品三',
  '回归商品四',
]

/** 每次创建独立的共同首页输入，不改变两个产品的默认分页策略。 */
export function createRetailParityHomeGoods(): RetailHomeGoods[] {
  return HOME_TITLES.map((title, index) => ({
    originPrice: 16900,
    price: 9900,
    spuId: `retail-parity-${index}`,
    tags: ['精选'],
    thumb: 'https://tdesign.gtimg.com/miniprogram/template/retail/goods/nz-09a.png',
    title,
  }))
}

function matchesInput(actual: unknown, expected: RetailHomeGoods[]) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((item: unknown, index) => {
      if (!item || typeof item !== 'object') {
        return false
      }
      const value = item as Record<string, unknown>
      const sample = expected[index]!
      return Object.entries(sample).every(([key, field]) => Array.isArray(field)
        ? Array.isArray(value[key]) && JSON.stringify(value[key]) === JSON.stringify(field)
        : value[key] === field)
    })
}

/** 先封存自然加载证据，再用共同输入验证真实渲染数量及全部卡片文字。 */
export async function prepareRetailParityHome(options: {
  page: RetailHomePage
  captureNatural: () => Promise<unknown>
  recordNatural: (evidence: unknown) => Promise<void>
  timeoutMs?: number
}) {
  const { page } = options
  const [goodsList, status, pageLoading] = await Promise.all([
    page.data('goodsList'),
    page.data('goodsListLoadStatus'),
    page.data('pageLoading'),
  ])
  if (!Array.isArray(goodsList) || goodsList.length === 0 || status !== 0 || pageLoading !== false) {
    throw new Error('Retail parity requires successful natural home loading before preparing common input')
  }
  await options.recordNatural({
    goodsList,
    goodsCount: goodsList.length,
    goodsListLoadStatus: status,
    pageLoading,
    document: await options.captureNatural(),
  })
  const goods = createRetailParityHomeGoods()
  await page.setData({ goodsList: goods })
  const startedAt = Date.now()
  let lastObservation: unknown
  do {
    const actual = await page.data('goodsList')
    // 商品标题位于自定义组件内部，页面 CSS 查询不会穿过组件边界。
    const nodes = await page.getElementsByXpath('//*[contains(concat(" ", @class, " "), " goods-card__title ")]', { fallback: false, timeout: 1000 })
    const rawTitles = await Promise.all(nodes.map(node => node.text()))
    const titles = rawTitles.map(title => title.trim())
    lastObservation = { actual, count: nodes.length, rawTitles, titles }
    if (matchesInput(actual, goods) && nodes.length === goods.length
      && titles.every((title, index) => title === goods[index]!.title)) {
      return { goodsList: actual, renderedCount: nodes.length, rawTitles, titles }
    }
    if (Date.now() - startedAt >= (options.timeoutMs ?? 10_000)) {
      break
    }
    await page.waitFor(100)
  } while (true)
  throw new Error(`Retail parity common home input did not render: ${JSON.stringify(lastObservation)}`)
}
