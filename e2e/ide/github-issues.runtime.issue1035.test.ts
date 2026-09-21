import { ok as assert } from 'node:assert'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  APP_ROOT,
  DIST_ROOT,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  releaseSharedMiniProgram,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'

const HOME = '/pages/issue-1035/index'
const NEXT = '/pages/issue-1035-next/index'

function homeCheckpoint(id: string) {
  return {
    id,
    route: HOME,
    action: '验证首页读取 App setup 创建的 router 并完成渲染',
    nodes: [{ selector: '#issue-1035-identity', text: 'same router: true' }],
  }
}

interface RouterSnapshot {
  sameRouter: boolean
  target: string
  trace: string[]
  from?: string
}

describe('e2e app: github-issues / issue #1035', { concurrent: false }, () => {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const route of [HOME, NEXT]) {
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await fs.pathExists(path.join(DIST_ROOT, `${route.slice(1)}.${extension}`))).toBe(true)
      }
    }
    const app = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as { pages: string[] }
    expect(app.pages[0]).toBe(HOME.slice(1))
    // 必须观察真正的首屏，禁止 warmup 用 reLaunch 掩盖冷启动失败。
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      trustProject: true,
      warmupRoute: HOME,
      warmupAllowRelaunch: false,
      disableRelaunchSessionRecovery: true,
    })
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    if (miniProgram) {
      await releaseSharedMiniProgram(miniProgram)
    }
  }, 30_000)

  it('shares the App router on cold start, navigation, back and reLaunch', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [
      homeCheckpoint('cold-start'),
      {
        id: 'navigate',
        route: NEXT,
        action: '点击命名路由跳转并读取同一 router 和 query',
        nodes: [
          { selector: '#issue-1035-next-identity', text: 'same router: true' },
          { selector: '#issue-1035-query', text: 'from: home' },
        ],
      },
      homeCheckpoint('back'),
      homeCheckpoint('relaunch'),
    ])
    assert(miniProgram, 'Expected the shared cold-start session')
    const page = await waitForCurrentPagePath(miniProgram, HOME)
    assert(page, 'Expected the cold-start home page')
    await page.waitForRendered({ selector: '#issue-1035-home', timeout: 10_000 })
    await expect.poll(() => page.callMethod('readSnapshot')).toEqual({
      sameRouter: true,
      target: NEXT.slice(1),
      trace: ['app:setup', 'app:router-created', 'app:onLaunch', 'home:setup', 'home:onLoad', 'home:mounted'],
    })
    await dom.check('cold-start', miniProgram, page)

    const navigate = await page.$('#issue-1035-next')
    assert(navigate, 'Expected navigation button')
    await navigate.tap()
    const nextPage = await waitForCurrentPagePath(miniProgram, NEXT)
    assert(nextPage, 'Expected named route destination')
    await nextPage.waitForRendered({ selector: '#issue-1035-next-page', timeout: 10_000 })
    expect(await nextPage.callMethod('readSnapshot')).toMatchObject({ sameRouter: true, from: 'home' })
    await expect.poll(async () => (await nextPage.callMethod('readSnapshot') as RouterSnapshot).trace, { timeout: 15_000 }).toContain('home:navigate:done')
    await dom.check('navigate', miniProgram, nextPage)

    const back = await nextPage.$('#issue-1035-back')
    assert(back, 'Expected back button')
    await back.tap()
    const returnedPage = await waitForCurrentPagePath(miniProgram, HOME)
    assert(returnedPage, 'Expected original page after back')
    await expect.poll(async () => (await returnedPage.callMethod('readSnapshot') as RouterSnapshot).trace, { timeout: 15_000 }).toContain('next:back:done')
    await dom.check('back', miniProgram, returnedPage)

    await miniProgram.reLaunch(HOME)
    const relaunchedPage = await waitForCurrentPagePath(miniProgram, HOME)
    assert(relaunchedPage, 'Expected relaunched home page')
    await relaunchedPage.waitForRendered({ selector: '#issue-1035-home', timeout: 10_000 })
    const snapshot = await relaunchedPage.callMethod('readSnapshot') as RouterSnapshot
    expect(snapshot.sameRouter).toBe(true)
    expect(snapshot.trace.filter(event => event === 'app:setup')).toHaveLength(1)
    expect(snapshot.trace.filter(event => event === 'home:setup')).toHaveLength(2)
    await dom.check('relaunch', miniProgram, relaunchedPage)
  })
})
