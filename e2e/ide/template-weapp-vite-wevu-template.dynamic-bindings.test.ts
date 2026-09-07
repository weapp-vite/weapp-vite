import type { DomNodeExpectation } from '../utils/domAcceptance/types'
import { setTimeout as delay } from 'node:timers/promises'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
let miniProgram: any

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-regression-simplified-portal',
  })
}

async function waitForPage(miniProgram: any, route: string) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const page = await miniProgram.currentPage()
    if (page?.path.replace(/^\/+/, '') === route.replace(/^\/+/, '')) {
      return page
    }
    await delay(100)
  }
  throw new Error(`Portal navigation did not reach ${route}`)
}

describe('e2e app: template-wevu-regression simplified portal', { concurrent: false }, () => {
  beforeAll(async () => {
    await runBuild()
    miniProgram = await launchAutomator({ projectPath: TEMPLATE_ROOT })
  }, 240_000)

  afterAll(async () => {
    await miniProgram?.close()
    miniProgram = undefined
  })

  it('emits the simplified portal structure and auto-imported component usage', async (ctx) => {
    const targets = [
      { id: 'overview', route: '/pages/overview/index', title: '运营概览', index: 0 },
      { id: 'workspace', route: '/packageA/pages/workspace/index', title: '项目工作台', index: 1 },
      { id: 'settings', route: '/packageB/pages/settings/index', title: '系统设置', index: 2 },
    ]
    const homeNodes: DomNodeExpectation[] = [
      { selector: '.hero__eyebrow', text: '企业业务模板' },
      { selector: '.metric-card', count: 3 },
      ...['12', '86%', '99.95%'].map((text, index) => ({
        selector: `(//*[contains(concat(" ", @class, " "), " metric-card__value ")])[${index + 1}]`,
        query: 'xpath' as const,
        text,
      })),
      { selector: '.entry-card', count: 4 },
      { selector: '.route-note', text: '当前路由：/pages/index/index' },
      { selector: '.badge--accent', scope: [{ has: '.badge--accent' }], text: '主包首页' },
      { selector: '.badge--neutral', scope: [{ has: '.badge--neutral' }], text: '可扩展分包' },
      { selector: '.badge--success', scope: [{ has: '.badge--success' }], text: '适合二次开发' },
    ]
    const dom = createDomAcceptance(ctx, 'e2e-apps/template-wevu-regression', [
      { id: 'portal', route: '/pages/index/index', action: 'launch portal', nodes: homeNodes },
      ...targets.flatMap(target => [
        { id: target.id, route: target.route, action: `tap ${target.title} portal entry`, nodes: [
          { selector: '.card__title', text: target.title },
          { selector: '.card__summary', text: `当前路由：${target.route}` },
        ] },
        { id: `${target.id}-return`, route: '/pages/index/index', action: 'reLaunch portal', nodes: homeNodes },
      ]),
    ])

    const indexWxmlPath = path.join(DIST_ROOT, 'pages/index/index.wxml')
    const indexJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const appJsonPath = path.join(DIST_ROOT, 'app.json')

    expect(await fs.pathExists(indexWxmlPath)).toBe(true)
    expect(await fs.pathExists(indexJsPath)).toBe(true)
    expect(await fs.pathExists(appJsonPath)).toBe(true)

    const indexWxml = await fs.readFile(indexWxmlPath, 'utf8')
    const indexJs = await fs.readFile(indexJsPath, 'utf8')
    const indexConfig = await fs.readJson(path.join(DIST_ROOT, 'pages/index/index.json')) as { usingComponents: Record<string, string> }
    const appJson = await fs.readJson(appJsonPath) as { pages: string[], subPackages: unknown[] }

    expect(appJson.pages).toEqual([
      'pages/index/index',
      'pages/layouts/index',
      'pages/overview/index',
    ])
    expect(appJson.subPackages).toEqual([
      {
        root: 'packageA',
        pages: ['pages/workspace/index'],
      },
      {
        root: 'packageB',
        pages: ['pages/settings/index'],
        independent: true,
      },
    ])

    expect(indexWxml).toContain('企业业务模板')
    expect(indexWxml).toContain('当前路由：{{routeSummary}}')
    expect(indexWxml).toContain('<status-pill')
    expect(indexWxml).toContain('<info-panel')
    expect(indexConfig.usingComponents).toMatchObject({
      'status-pill': '/components/StatusPill/index',
      'info-panel': '/components/InfoPanel/index',
    })

    expect(indexJs).toContain('/pages/overview/index')
    expect(indexJs).toContain('/packageA/pages/workspace/index')
    expect(indexJs).toContain('/packageB/pages/settings/index')
    expect(indexJs).toContain('进入概览')
    expect(indexJs).toContain('打开工作台')
    expect(indexJs).toContain('前往设置')
    expect(indexJs).toContain('nativeRouter.reLaunch')

    let page = await miniProgram.reLaunch('/pages/index/index')
    await dom.check('portal', miniProgram, page)
    for (const target of targets) {
      const homePage = page
      const buttons = await page.$$('.entry-card .action-btn', { fallback: false })
      expect(buttons).toHaveLength(4)
      await buttons[target.index]!.tap()
      page = await waitForPage(miniProgram, target.route)
      await dom.check(target.id, miniProgram, page)
      // 目标 DOM 可早于 navigateTo 的宿主回调；提前 reLaunch 会让同一次导航超时。
      // 首页仍保留在页面栈中，但 Page 协议只能调用栈顶；显式通过 AppService 等待原首页的 Promise。
      expect(await homePage.callMethodWithOptions('waitForNavigation', { routeOnly: true }, target.route)).toBe(target.route)
      page = await miniProgram.reLaunch('/pages/index/index')
      await dom.check(`${target.id}-return`, miniProgram, page)
    }
  })
})
