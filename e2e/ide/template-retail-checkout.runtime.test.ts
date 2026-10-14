import { access, readFile, rm } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { RETAIL_CHECKOUT_GOODS, RETAIL_CHECKOUT_ROUTE, retailCheckoutNodes } from '../utils/templateAcceptance/retailCheckout'
import {
  createRetailGoodsCardProject,
  RETAIL_GOODS_CARD_ROUTE,
  RETAIL_GOODS_CARD_VARIANTS,
  retailGoodsCardNodes,
  retailGoodsCardSelector,
} from '../utils/templateAcceptance/retailGoodsCard'

const FIXTURE = 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template'
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../', FIXTURE)
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
let miniProgram: any
let projectRoot: string | undefined

/** 失败诊断只记录有界摘要，任何采集异常均不能替代原验收错误。 */
async function captureHomeFailureDiagnostics(home: any) {
  const timeout = 2_500
  async function observe(read: () => Promise<unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return {
        status: 'fulfilled',
        value: await Promise.race([
          Promise.resolve().then(read),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              const error = new Error('DiagnosticTimeout')
              error.name = 'DiagnosticTimeout'
              reject(error)
            }, timeout)
          }),
        ]),
      }
    }
    catch (error) {
      return { status: 'rejected', error: error instanceof Error ? error.name : typeof error }
    }
    finally {
      clearTimeout(timer)
    }
  }

  const [state, goodsCount, component, bindings] = await Promise.all([
    observe(async () => {
      const state = await home.data('__e2eHomeState', { fallback: false, timeout })
      return Object.fromEntries(['ready', 'goodsCount', 'loadStatus', 'pageLoading', 'tabCount', 'swiperCount']
        .map(key => [key, state?.[key]]))
    }),
    observe(async () => {
      const goods = await home.data('goodsList', { fallback: false, timeout })
      return Array.isArray(goods) ? goods.length : null
    }),
    observe(async () => await miniProgram.evaluateWithOptions(() => {
      const pages = getCurrentPages() as any[]
      const list = pages[pages.length - 1]?.selectComponent?.('goods-list')
      return list
        ? {
            found: true,
            id: list.id,
            listId: list.properties?.listId,
            independentID: list.data?.independentID,
            propertiesGoodsCount: Array.isArray(list.properties?.goodsList) ? list.properties.goodsList.length : null,
            dataGoodsCount: Array.isArray(list.data?.goodsList) ? list.data.goodsList.length : null,
          }
        : { found: false }
    }, { timeout })),
    observe(async () => {
      if (!projectRoot) {
        return null
      }
      const sources = await Promise.all(['pages/home/home.wxml', 'components/goods-list/index.wxml']
        .map(file => readFile(path.join(projectRoot!, 'dist', file), 'utf8')))
      return sources.flatMap(source => source.match(/<(?:goods-list|goods-card)\b[^>]*>/g) ?? [])
        .slice(0, 2)
        .map(tag => tag.slice(0, 800))
    }),
  ])
  process.stdout.write(`[retail-home-failure-diagnostics] ${JSON.stringify({ checkpoint: 'home-ready', state, goodsCount, component, bindings })}\n`)
}

describe('retail checkout and goods card contracts', { concurrent: false }, () => {
  beforeAll(async () => {
    projectRoot = await createRetailGoodsCardProject(TEMPLATE_ROOT)
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot,
      platform: 'weapp',
      cwd: projectRoot,
      label: 'ide:retail-checkout',
    })
    for (const route of [RETAIL_CHECKOUT_ROUTE, RETAIL_GOODS_CARD_ROUTE]) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(projectRoot, 'dist', `${route.slice(1)}.${extension}`))
      }
    }
    // 与零售模板全路由验收保持同一宿主启动设置；结算缓存随后在共享会话中写入。
    const previousRefresh = process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH
    try {
      process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH = '1'
      miniProgram = await launchAutomator({
        projectPath: projectRoot,
        projectConfig: {
          setting: { useApiHostProcess: false, useIsolateContext: false, useMultiFrameRuntime: false },
        },
        skipRelaunchPageRootCheck: true,
        skipWarmup: true,
        timeout: 120_000,
      })
    }
    finally {
      if (previousRefresh == null) {
        delete process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH
      }
      else {
        process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH = previousRefresh
      }
    }
  }, 240_000)

  afterAll(async () => {
    try {
      await miniProgram?.close()
    }
    finally {
      miniProgram = undefined
      if (projectRoot) {
        await rm(projectRoot, { recursive: true, force: true })
        projectRoot = undefined
      }
    }
  })

  it('renders nullable settlement results and refreshes quantity and amount after reLaunch', async (ctx) => {
    const scenarios = [
      { id: 'single-item', quantity: 1, action: '缓存一件商品后打开结算页，检查商品、数量、单价与优惠后小计' },
      { id: 'two-items', quantity: 2, action: '将购物车改为两件并 reLaunch，检查数量和小计更新' },
      { id: 'single-item-restored', quantity: 1, action: '恢复一件商品并 reLaunch，检查没有沿用上次结算状态' },
    ] as const
    const dom = createDomAcceptance(ctx, FIXTURE, [{
      id: 'home-ready',
      route: '/pages/home/home',
      action: '从首页启动并确认首屏商品已经呈现，再进入结算分包',
      nodes: [{
        selector: '.goods-card__title',
        scope: [{ has: '.goods-list-wrap' }, '#home-goods-list-gd-0'],
        text: '白色短袖连衣裙荷叶边裙摆宽松韩版休闲纯白清爽优雅连衣裙',
      }],
    }, ...scenarios.map(scenario => ({
      id: scenario.id,
      route: RETAIL_CHECKOUT_ROUTE,
      action: scenario.action,
      nodes: retailCheckoutNodes(scenario.quantity),
    }))])
    const home = await dom.act('home-ready', () => miniProgram.reLaunch('/pages/home/home'))
    try {
      await dom.check('home-ready', miniProgram, home)
    }
    catch (error) {
      try {
        await captureHomeFailureDiagnostics(home)
      }
      catch (diagnosticError) {
        try {
          process.stdout.write(`[retail-home-failure-diagnostics] ${JSON.stringify({ status: 'rejected', error: diagnosticError instanceof Error ? diagnosticError.name : typeof diagnosticError })}\n`)
        }
        catch {
          // 诊断输出自身失败不能覆盖原验收异常。
        }
      }
      throw error
    }
    for (const scenario of scenarios) {
      const goods = RETAIL_CHECKOUT_GOODS.map(item => ({ ...item, quantity: scenario.quantity }))
      const page = await dom.act(scenario.id, async () => {
        await miniProgram.callWxMethod('setStorageSync', 'order.goodsRequestList', JSON.stringify(goods))
        return await miniProgram.reLaunch(`${RETAIL_CHECKOUT_ROUTE}?type=cart`)
      })
      await dom.check(scenario.id, miniProgram, page)
    }
  }, 120_000)

  it('passes cardId through cart, order and specs cards while retaining generated IDs and goods identity', async (ctx) => {
    const dom = createDomAcceptance(ctx, FIXTURE, [
      {
        id: 'initial-card-ids',
        route: RETAIL_GOODS_CARD_ROUTE,
        action: '通过父级绑定分别传入三类卡片的 cardId，并对照未传值时生成的节点标识',
        nodes: retailGoodsCardNodes('explicit'),
      },
      ...RETAIL_GOODS_CARD_VARIANTS.map(variant => ({
        id: `click-${variant}`,
        route: RETAIL_GOODS_CARD_ROUTE,
        action: `点击 ${variant} 卡片，检查独立节点标识没有覆盖事件中的商品 id`,
        nodes: [{ selector: '#retail-goods-last-click', text: `${variant}:retail-business-goods` }],
      })),
      {
        id: 'updated-card-ids',
        route: RETAIL_GOODS_CARD_ROUTE,
        action: '更新父级 cardId，检查三类卡片的宿主节点标识随属性更新',
        nodes: retailGoodsCardNodes('updated'),
      },
      {
        id: 'cleared-card-ids',
        route: RETAIL_GOODS_CARD_ROUTE,
        action: '清空父级 cardId，检查三类卡片恢复自动生成的节点标识',
        nodes: retailGoodsCardNodes('cleared'),
      },
    ])
    const page = await dom.act('initial-card-ids', () => miniProgram.reLaunch(RETAIL_GOODS_CARD_ROUTE))
    await dom.check('initial-card-ids', miniProgram, page)
    for (const variant of RETAIL_GOODS_CARD_VARIANTS) {
      await dom.act(`click-${variant}`, async () => {
        const cards = await page.getElementsByXpath(retailGoodsCardSelector(variant, 'explicit'), { fallback: false })
        expect(cards).toHaveLength(1)
        await cards[0].tap()
      })
      await dom.check(`click-${variant}`, miniProgram, page)
    }
    await dom.act('updated-card-ids', () => page.callMethod('updateCardIds'))
    await dom.check('updated-card-ids', miniProgram, page)
    await dom.act('cleared-card-ids', () => page.callMethod('clearCardIds'))
    await dom.check('cleared-card-ids', miniProgram, page)
    for (const variant of RETAIL_GOODS_CARD_VARIANTS) {
      for (const kind of ['explicit', 'default'] as const) {
        const cards = await page.getElementsByXpath(retailGoodsCardSelector(variant, kind), { fallback: false })
        expect(cards).toHaveLength(1)
        const card = cards[0]
        const readAttribute = card.attribute ?? card.attr
        expect(await readAttribute.call(card, 'id')).toMatch(/^goods-card-\d+$/)
      }
    }
  }, 120_000)
})
