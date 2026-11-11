import type { MiniProgram, Page } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1313'
const ROUTE = '/pages/index/index'

function regionNodes(scope: boolean, settings: boolean) {
  return [
    { selector: '//button[contains(., "切换地点与批次")]', query: 'xpath' as const, count: 1 },
    { selector: '//button[contains(., "切换重量与分组")]', query: 'xpath' as const, count: 1 },
    { selector: '//view[contains(., "地点与批次设置")]', query: 'xpath' as const, count: Number(scope), text: '地点与批次设置' },
    { selector: '//view[contains(., "重量与分组设置")]', query: 'xpath' as const, count: Number(settings), text: '重量与分组设置' },
  ]
}

async function tapOriginalButton(page: Page, label: string) {
  const buttons = await page.getElementsByXpath(`//button[contains(., "${label}")]`, { fallback: false })
  expect(buttons).toHaveLength(1)
  await buttons[0]!.tap()
}

describe('issue #1313: original reactive inline toggle expressions', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let errors: RuntimeErrorCollector | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1313)
    await buildIssueRegressionProject(project, 'weapp')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([ROUTE.slice(1)])
    for (const entry of ['app', ...app.pages]) {
      for (const extension of entry === 'app' ? ['js', 'json'] : ['js', 'json', 'wxml']) {
        await access(path.join(project, 'dist', `${entry}.${extension}`))
      }
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['button'],
    })
    errors = attachRuntimeErrorCollector(host)
  }, 180_000)

  afterEach(() => {
    expect(errors?.getAll()).toEqual([])
  })

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport: () => errors?.dispose(),
      closeSession: () => host?.close(),
      stopDev: () => {},
    })
  }, 120_000)

  it('opens and closes each original region independently and resets state on reLaunch', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTE, action: '用户原始 SFC 首次挂载，两个设置区域均收起', nodes: regionNodes(false, false) },
      { id: 'scope', route: ROUTE, action: '点击地点与批次按钮，只展开对应区域', nodes: regionNodes(true, false) },
      { id: 'both', route: ROUTE, action: '点击重量与分组按钮，两个区域独立展开', nodes: regionNodes(true, true) },
      { id: 'settings', route: ROUTE, action: '再次点击地点与批次，保留重量与分组展开', nodes: regionNodes(false, true) },
      { id: 'closed', route: ROUTE, action: '再次点击重量与分组，两个区域均收起', nodes: regionNodes(false, false) },
      { id: 'reopened', route: ROUTE, action: '展开后复用同一宿主 reLaunch，恢复初始状态', nodes: regionNodes(false, false) },
    ])
    const page = await host!.currentPage()
    expect(page).toBeTruthy()
    await dom.check('initial', host!, page)
    await tapOriginalButton(page!, '切换地点与批次')
    await dom.check('scope', host!, page)
    await tapOriginalButton(page!, '切换重量与分组')
    await dom.check('both', host!, page)
    await tapOriginalButton(page!, '切换地点与批次')
    await dom.check('settings', host!, page)
    await tapOriginalButton(page!, '切换重量与分组')
    await dom.check('closed', host!, page)
    await tapOriginalButton(page!, '切换地点与批次')
    const reopened = await host!.reLaunch(ROUTE)
    await dom.check('reopened', host!, reopened)
  })
})
