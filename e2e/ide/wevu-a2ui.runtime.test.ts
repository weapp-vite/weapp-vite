import { randomUUID } from 'node:crypto'
import { access, mkdir, readdir, readFile, stat } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ACCEPTANCE_REPORT_DIR_ENV, ACCEPTANCE_ROOT } from '../scripts/domAcceptanceReport/helpers'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-a2ui-demo')
const route = '/pages/index/index'
// 假 agent 固定 600 ms 回包，且 web_core 0.16 起动作按异步执行派发，回包驱动的轮询需要明确预算。
const replyPoll = { timeout: 5_000 }
let miniProgram: any

async function element(page: any, tag: string, id: string) {
  const nodes = await page.getElementsByXpath(`//${tag}[@id="${id}"]`, { fallback: false })
  expect(nodes, `${tag}#${id}`).toHaveLength(1)
  return nodes[0]
}

async function reasonValue(page: any) {
  const reason = await element(page, 'input', 'reason')
  return typeof reason.attr === 'function' ? await reason.attr('value') : await reason.property('value')
}

async function inputReason(page: any, value: string) {
  await (await element(page, 'input', 'reason')).input(value)
  // 等待投影刷新后再取下一次交互句柄，避免拿到被替换前的节点。
  await expect.poll(() => reasonValue(page)).toBe(value)
}

async function bytes(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true })
  const sizes = await Promise.all(entries.map(async entry => entry.isDirectory()
    ? bytes(path.join(directory, entry.name))
    : (await stat(path.join(directory, entry.name))).size))
  return sizes.reduce((sum, size) => sum + size, 0)
}

describe('Wevu A2UI runtime', { concurrent: false }, () => {
  beforeAll(async () => {
    await runWeappViteBuildWithLogCapture({
      cliPath: path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'),
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ide:wevu-a2ui',
    })
    const config = JSON.parse(await readFile(path.join(APP_ROOT, 'dist/app.json'), 'utf8')) as { pages: string[] }
    for (const page of config.pages) {
      await Promise.all(['js', 'json', 'wxml'].map(ext => access(path.join(APP_ROOT, `dist/${page}.${ext}`))))
    }
    process.stdout.write(`a2ui emitted bytes: ${await bytes(path.join(APP_ROOT, 'dist'))}\n`)
    miniProgram = await launchAutomator({ projectPath: APP_ROOT, skipWarmup: true })
  }, 240_000)

  afterAll(async () => {
    await miniProgram?.close()
  })

  it('renders a public-package basic catalog without a custom business component', async (ctx) => {
    const basicRoute = '/pages/basic/index'
    const dom = createDomAcceptance(ctx, 'apps/wevu-a2ui-demo', [{
      id: 'basic',
      route: basicRoute,
      action: '仅使用包内基础组件',
      nodes: [
        { selector: '//text[@id="label"]', query: 'xpath', text: '基础组件无需业务适配' },
        { selector: '//input[@id="nestedField"]', query: 'xpath', count: 1 },
      ],
    }])
    const page = await miniProgram.reLaunch(basicRoute)
    await dom.check('basic', miniProgram, page)
  })

  it('renders recursive surfaces and forwards real input/tap events through Wevu components', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'apps/wevu-a2ui-demo', [{
      id: 'ready',
      route,
      action: '首次渲染售后 surface',
      nodes: [
        { selector: '.heading', text: '让每一次购物都有回应。' },
        { selector: '//text[@id="hint"]', query: 'xpath', text: '请描述商品问题，方便我们为你处理。' },
        { selector: '//input[@id="reason"]', query: 'xpath', count: 1 },
        { selector: '//textarea[@id="detail"]', query: 'xpath', attributes: { placeholder: '选填：物流、包装等细节' } },
        { selector: '//text[@id="order-product"]', query: 'xpath', text: '日常随行杯 · 雾白' },
      ],
    }, {
      id: 'submitted',
      route,
      action: '输入写回数据模型，提交后由 agent 回包刷新状态',
      nodes: [{ selector: '//text[@id="status"]', query: 'xpath', text: '申请已提交，我们会尽快联系你' }],
    }])
    const page = await miniProgram.reLaunch(route)
    await dom.check('ready', miniProgram, page)
    if (resolveRuntimeProviderName() === 'devtools') {
      const reportDir = process.env[ACCEPTANCE_REPORT_DIR_ENV] || path.join(ACCEPTANCE_ROOT, 'docs/reports/dom-acceptance')
      await mkdir(reportDir, { recursive: true })
      await miniProgram.screenshot({ path: path.join(reportDir, `a2ui-after-sales-${randomUUID()}.png`) })
    }
    await (await element(page, 'button', 'inspect')).tap()
    await expect.poll(async () => (await element(page, 'text', 'status')).text(), replyPoll).toBe('演示订单：DEMO-2026-001，实付 ¥129.00')
    await inputReason(page, '杯盖有划痕')
    await expect.poll(() => page.data('model.reason')).toBe('杯盖有划痕')
    const submit = await element(page, 'button', 'submit')
    await submit.tap()
    await submit.tap()
    await expect.poll(() => page.data('model.pending'), replyPoll).toBe(false)
    expect(await page.data('model.submissions')).toBe(1)
    expect(await page.data('model.delivered')).toBe(2)
    expect(await page.data('model.actionNames')).toEqual(['inspect', 'submit'])
    await expect.poll(async () => (await element(page, 'text', 'status')).text(), replyPoll).toBe('申请已提交，我们会尽快联系你')
    expect(await page.data('model.steps')).toHaveLength(3)
    await dom.check('submitted', miniProgram, page)
  })

  it('preserves input across streamed updates and recovers from an invalid message', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'apps/wevu-a2ui-demo', [{
      id: 'streamed',
      route,
      action: '增量更新后保持页面',
      nodes: [
        { selector: '//text[@id="progress"]', query: 'xpath', text: '预计 24 小时内处理，我们会及时通知你。' },
        { selector: '//text[@id="hint"]', query: 'xpath', text: '' },
        { selector: '//textarea[@id="detail"]', query: 'xpath', count: 1 },
      ],
    }])
    const page = await miniProgram.reLaunch(route)
    await inputReason(page, '请保留这段内容')
    await (await page.$('#play')).tap()
    await expect.poll(async () => page.data('model.progress'), { timeout: 15_000 }).toContain('24 小时')
    await expect.poll(() => page.data('model.playing')).toBe(false)
    await dom.check('streamed', miniProgram, page)
    expect(await page.data('model.reason')).toBe('请保留这段内容')
    expect(await reasonValue(page)).toBe('请保留这段内容')
    expect(await page.data('model.title')).toBe('申请售后 · 专属服务')
    expect(await page.data('model.steps')).toHaveLength(3)
    // 页面方法走 AppService 路由协议读取，真实开发者工具与 headless 都支持该路径。
    process.stdout.write(`a2ui stream metrics: ${JSON.stringify(await page.callMethodWithOptions('readMetrics', { routeOnly: true }))}\n`)
    await (await page.$('#invalid')).tap()
    await expect.poll(() => page.data('model.error')).not.toBe('')
    expect(await (await element(page, 'text', 'progress')).text()).toContain('24 小时')
    await (await page.$('#reset')).tap()
    await expect.poll(() => page.data('model.error')).toBe('')
    expect(await page.data('model.reason')).toBe('')
    expect(await page.data('model.steps')).toHaveLength(2)
  })

  it('supports failure/retry and cancels in-flight work when the page unloads', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'apps/wevu-a2ui-demo', [{
      id: 'returned',
      route,
      action: '卸载后重新打开干净页面',
      nodes: [
        { selector: '//text[@id="status"]', query: 'xpath', text: '填写原因后提交申请' },
        { selector: '//text[@id="hint"]', query: 'xpath', count: 1 },
      ],
    }])
    let page = await miniProgram.reLaunch(route)
    await inputReason(page, '模拟失败')
    await (await element(page, 'button', 'submit')).tap()
    await expect.poll(async () => (await element(page, 'text', 'error')).text(), replyPoll).toContain('暂不可用')
    await inputReason(page, '修改后的申请')
    await (await element(page, 'button', 'submit')).tap()
    await expect.poll(async () => (await element(page, 'text', 'status')).text()).toBe('申请已提交，我们会尽快联系你')
    await (await page.$('#reset')).tap()
    await expect.poll(() => reasonValue(page)).toBe('')
    await inputReason(page, '卸载前提交')
    await (await element(page, 'button', 'submit')).tap()
    await (await page.$('#play')).tap()
    const blank = await miniProgram.reLaunch('/pages/blank/index')
    // 等待超过假 agent 回包和首批增量任务的期限，检查卸载后没有宿主写入。
    await new Promise(resolve => setTimeout(resolve, 700))
    const metrics = await blank.callMethodWithOptions('readMetrics', { routeOnly: true })
    // 卸载时确实有在途任务被取消（>0），且没有任何一次迟到 setData（=0）。
    expect(metrics.cancelledTasks, JSON.stringify(metrics)).toBeGreaterThan(0)
    expect(metrics.lateSetData).toBe(0)
    page = await miniProgram.reLaunch(route)
    await dom.check('returned', miniProgram, page)
    expect(await page.data('model.playing')).toBe(false)
    expect(await page.data('model.pending')).toBe(false)
    expect(await page.data('model.reason')).toBe('')
    expect(await page.data('model.submissions')).toBe(0)
  })
})
