import { access, rm } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { RETAIL_CHECKOUT_GOODS, RETAIL_CHECKOUT_ROUTE, retailCheckoutNodes } from '../utils/templateAcceptance/retailCheckout'

const FIXTURE = 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template'
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../', FIXTURE)
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
let miniProgram: any

describe('retail checkout nullable settlement rendering', { concurrent: false }, () => {
  beforeAll(async () => {
    await rm(path.join(PROJECT_ROOT, 'dist'), { recursive: true, force: true })
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: PROJECT_ROOT,
      platform: 'weapp',
      cwd: PROJECT_ROOT,
      label: 'ide:retail-checkout',
    })
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(PROJECT_ROOT, 'dist', `${RETAIL_CHECKOUT_ROUTE.slice(1)}.${extension}`))
    }
    // 与零售模板全路由验收保持同一宿主启动设置；结算缓存随后在共享会话中写入。
    const previousRefresh = process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH
    try {
      process.env.WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH = '1'
      miniProgram = await launchAutomator({
        projectPath: PROJECT_ROOT,
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
    await miniProgram?.close()
    miniProgram = undefined
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
    await dom.check('home-ready', miniProgram, home)
    for (const scenario of scenarios) {
      const goods = RETAIL_CHECKOUT_GOODS.map(item => ({ ...item, quantity: scenario.quantity }))
      const page = await dom.act(scenario.id, async () => {
        await miniProgram.callWxMethod('setStorageSync', 'order.goodsRequestList', JSON.stringify(goods))
        return await miniProgram.reLaunch(`${RETAIL_CHECKOUT_ROUTE}?type=cart`)
      })
      await dom.check(scenario.id, miniProgram, page)
    }
  }, 120_000)
})
