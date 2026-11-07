import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { exerciseIssue1304Watch, ISSUE_1304_FINAL_VALUE, ISSUE_1304_ROUTE } from '../utils/issue1304Watch'
import { startIssueClassicDev } from '../utils/issueClassicDev'
import { createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1304'

describe('issue #1304: real lazy modules after classic rebuilds', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let dev: ReturnType<typeof startIssueClassicDev> | undefined
  let errors: RuntimeErrorCollector | undefined
  let watchFailed = false

  beforeAll(async () => {
    project = await createIssueRegressionProject(1304)
    dev = startIssueClassicDev(project)
    try {
      await exerciseIssue1304Watch(project, dev)
      // 先完成真实 watch 世代，再让同一个宿主冷读最终产物，避免旧模块缓存掩盖丢失的 chunk。
      await dev.stop(5_000)
    }
    catch (error) {
      watchFailed = true
      process.stdout.write(dev.getOutput())
      await writeFile(path.join(project, 'watch-failure.log'), dev.getOutput())
      process.stdout.write(`[issue-1304] retained failed project: ${path.relative(process.cwd(), project).split(path.sep).join('/')}\n`)
      throw error
    }
    host = await launchAutomator({
      projectPath: project,
      trustProject: true,
      bridgeProjectMode: 'direct',
      warmupRoute: ISSUE_1304_ROUTE,
      warmupRootSelectors: ['#issue1304-page'],
    })
    errors = attachRuntimeErrorCollector(host)
  }, 300_000)

  afterEach(() => {
    expect(errors?.getAll()).toEqual([])
  })

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project: watchFailed ? undefined : project,
      disposeTransport: () => errors?.dispose(),
      closeSession: () => host?.close(),
      stopDev: () => dev?.stop(5_000),
    })
  }, 120_000)

  it('executes the restored lazy target and its updated shared dependency, then resets page state on reentry', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ISSUE_1304_ROUTE, action: 'watch 修改、移除和恢复后，冷启动尚未执行懒加载模块的页面', nodes: [{ selector: '#lazy-value', text: 'not loaded' }, { selector: '#lazy-count', text: '0' }] },
      { id: 'loaded', route: ISSUE_1304_ROUTE, action: '实际 require.async 执行恢复后的目标和更新后的共享依赖', nodes: [{ selector: '#lazy-value', text: ISSUE_1304_FINAL_VALUE }, { selector: '#lazy-count', text: '1' }] },
      { id: 'clicked', route: ISSUE_1304_ROUTE, action: '原生事件再次调用同一模块，产物依赖持续可用', nodes: [{ selector: '#lazy-value', text: ISSUE_1304_FINAL_VALUE }, { selector: '#lazy-count', text: '2' }] },
      { id: 'reopened', route: ISSUE_1304_ROUTE, action: '复用同一宿主重新进入页面，计数独立且仍可加载分包', nodes: [{ selector: '#lazy-value', text: ISSUE_1304_FINAL_VALUE }, { selector: '#lazy-count', text: '1' }] },
    ])
    const page = await host!.currentPage()
    await dom.check('initial', host!, page)
    expect(await page.callMethod('loadLazy')).toBe(ISSUE_1304_FINAL_VALUE)
    await dom.check('loaded', host!, page)
    const button = await page.$('#load-lazy')
    expect(button).toBeTruthy()
    await button!.tap()
    await dom.check('clicked', host!, page)
    const reopened = await host!.reLaunch(ISSUE_1304_ROUTE)
    expect(await reopened.callMethod('loadLazy')).toBe(ISSUE_1304_FINAL_VALUE)
    await dom.check('reopened', host!, reopened)
  })
})
