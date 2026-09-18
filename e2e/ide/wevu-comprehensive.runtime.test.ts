import { access, readFile } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'

const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-comprehensive-demo')
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
let miniProgram: any

describe('comprehensive demo public runtime contracts', { concurrent: false }, () => {
  beforeAll(async () => {
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ide:wevu-comprehensive',
    })
    const config = JSON.parse(await readFile(path.join(APP_ROOT, 'dist/app.json'), 'utf8')) as { pages: string[] }
    for (const page of config.pages) {
      await Promise.all(['js', 'json', 'wxml'].map(ext => access(path.join(APP_ROOT, `dist/${page}.${ext}`))))
    }
    miniProgram = await launchAutomator({ projectPath: APP_ROOT, skipWarmup: true })
  }, 240_000)

  afterAll(async () => {
    await miniProgram?.close()
  })

  it('updates Options API computed values through instance methods', async (ctx) => {
    const route = '/pages/computed/index'
    const dom = createDomAcceptance(ctx, 'apps/wevu-comprehensive-demo', [{
      id: 'updated',
      route,
      action: '更新姓名和数量',
      nodes: [{ selector: '.page-title', text: '计算属性' }],
    }])
    const page = await miniProgram.reLaunch(route)
    expect(await page.data('fullName')).toBe('张三')
    expect(await page.data('totalPrice')).toBe(200)
    await page.callMethod('updateFirstName')
    await page.callMethod('increaseQuantity')
    await expect.poll(() => page.data('fullName')).toBe('李三')
    await expect.poll(() => page.data('totalPrice')).toBe(300)
    await dom.check('updated', miniProgram, page)
  })

  it('renders lifecycle log aliases and clears the list', async (ctx) => {
    const route = '/pages/lifecycle/index'
    const dom = createDomAcceptance(ctx, 'apps/wevu-comprehensive-demo', [{
      id: 'added',
      route,
      action: '清空后添加一条日志',
      nodes: [{ selector: '.log-item', count: 1 }, { selector: '.log-index', text: '1.' }],
    }, {
      id: 'cleared',
      route,
      action: '清空日志',
      nodes: [{ selector: '.log-item', count: 0 }],
    }])
    const page = await miniProgram.reLaunch(route)
    await page.callMethod('clearLogs')
    await page.callMethod('addLog', '回归记录')
    await dom.check('added', miniProgram, page)
    expect(await page.data('logs')).toEqual([expect.stringContaining('回归记录')])
    await page.callMethod('clearLogs')
    await dom.check('cleared', miniProgram, page)
  })

  it('keeps created setup exports available after the initial mount', async (ctx) => {
    const route = '/pages/created-setup/index'
    const dom = createDomAcceptance(ctx, 'apps/wevu-comprehensive-demo', [{
      id: 'mounted',
      route,
      action: '读取 created 阶段 setup 与原生 export 合并结果',
      nodes: [{ selector: '.page-title', text: 'setup@created' }],
    }])
    const page = await miniProgram.reLaunch(route)
    await page.callMethod('readComponentExport')
    expect(await page.data('exportSummary')).toBe('fromExport=true, exposedFlag=true')
    expect(await page.data('pingResult')).toBe('pong(from export)')
    expect(await page.data('aValue')).toBe('0')
    const initialCount = await page.data('setDataCallCount')
    expect(Number(initialCount)).toBeGreaterThan(0)
    await dom.check('mounted', miniProgram, page)
    await page.callMethod('readComponentExport')
    expect(await page.data('setDataCallCount')).toBe(initialCount)
  })

  it('only offers explicit subpackage loading when the host provides it', async (ctx) => {
    const route = '/pages/subpackage-scenarios/index'
    const hasLoader = await miniProgram.evaluate(() => typeof Reflect.get(wx, 'loadSubPackage') === 'function')
    const dom = createDomAcceptance(ctx, 'apps/wevu-comprehensive-demo', [{
      id: 'capability',
      route,
      action: '按真实宿主能力显示分包加载入口',
      nodes: [{ selector: '.page-title', text: '分包场景（普通 / 独立）' }, { selector: '.load-subpackage', count: hasLoader ? 4 : 0 }],
    }])
    const page = await miniProgram.reLaunch(route)
    expect(await page.data('canLoadSubPackage')).toBe(hasLoader)
    await dom.check('capability', miniProgram, page)
    if (!hasLoader) {
      await page.callMethod('onLoadPackage', 'subpackages/normal-a')
      expect(await page.data('loadResult')).toContain('当前宿主不提供主动加载分包接口')
      expect((await page.data()).loadingRoot).toBeNull()
    }
  })

  for (const scenario of [
    { component: 'collapse', state: 'value', detail: { value: [1] }, expected: [1] },
    { component: 'steps', state: 'current', detail: { current: 2, previous: 1 }, expected: 2 },
    { component: 'side-bar', state: 'value', detail: { value: 1 }, expected: 1 },
  ]) {
    const { component, state, detail, expected } = scenario
    it(`reads the ${component} event detail field`, async (ctx) => {
      const route = `/pages/ui-tdesign/components/${component}/index`
      const dom = createDomAcceptance(ctx, 'apps/wevu-comprehensive-demo', [{
        id: 'changed',
        route,
        action: '派发组件 change 事件载荷',
        nodes: [{ selector: '.page-title', text: `t-${component}` }],
      }])
      const page = await miniProgram.reLaunch(route)
      await page.callMethod('onChange', { detail })
      await expect.poll(() => page.data(state)).toEqual(expected)
      await dom.check('changed', miniProgram, page)
    })
  }
})
