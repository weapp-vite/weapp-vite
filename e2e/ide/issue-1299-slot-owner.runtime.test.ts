import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { tapButton, textNode } from './issue1172/dom'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1299'
const ROUTE = '/pages/index/index'
const WITHOUT_LAYOUT = '/pages/without-layout/index'

function contextNodes(label: string, count: number) {
  return [
    textNode(`provider-${label}`, `provider:${count}`),
    textNode(`consumer-${label}`, `count:${count}`),
    textNode(`owner-${label}`, label),
    textNode(`identity-${label}`, 'same'),
  ]
}

function shellNode() {
  return { selector: '//*[@id="issue1299-app-shell"]', query: 'xpath' as const, count: 1 }
}

function layoutNode(count = 1) {
  return { selector: '//*[@id="issue1299-layout"]', query: 'xpath' as const, count }
}

describe('issue #1299: scriptless app-shell and layout slot owners', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let errors: RuntimeErrorCollector | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1299)
    await buildIssueRegressionProject(project, 'weapp')
    const dist = path.join(project, 'dist')
    const app = JSON.parse(await readFile(path.join(dist, 'app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([ROUTE.slice(1), WITHOUT_LAYOUT.slice(1)])
    for (const entry of [...app.pages, '__weapp_vite_app_shell', 'layouts/default']) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(dist, `${entry}.${extension}`))
      }
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
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

  it('injects the original context on initial mount through both scriptless owners and keeps providers isolated', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTE, action: '无脚本 app-shell 与 layout 首次挂载后，普通插槽消费者读到原 Provider 对象、ref 和 action', nodes: [shellNode(), layoutNode(), ...contextNodes('left', 0), ...contextNodes('right', 10)] },
      { id: 'left-updated', route: ROUTE, action: '左侧消费者调用注入 action，同一 ref 更新 Provider 与 Consumer，右侧保持独立', nodes: [...contextNodes('left', 1), ...contextNodes('right', 10)] },
      { id: 'right-updated', route: ROUTE, action: '右侧消费者调用自己的 action，不改变左侧上下文', nodes: [...contextNodes('left', 1), ...contextNodes('right', 11)] },
    ])
    const page = await host!.currentPage()
    await dom.check('initial', host!, page)
    await tapButton(page, 'increment-left')
    await dom.check('left-updated', host!, page)
    await tapButton(page, 'increment-right')
    await dom.check('right-updated', host!, page)
  })

  it('keeps app-shell context working without a layout and resets owner state on reLaunch', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'without-layout', route: WITHOUT_LAYOUT, action: 'layout:false 页面保留 app-shell 普通插槽，消费者首次 setup 可注入原上下文', nodes: [shellNode(), layoutNode(0), ...contextNodes('standalone', 20)] },
      { id: 'standalone-updated', route: WITHOUT_LAYOUT, action: '无 layout 的消费者更新同一 Provider ref', nodes: contextNodes('standalone', 21) },
      { id: 'reopened', route: ROUTE, action: '复用会话重新打开默认 layout 页面，释放旧 owner 并恢复两组 Provider 初始上下文', nodes: [shellNode(), layoutNode(), ...contextNodes('left', 0), ...contextNodes('right', 10)] },
      { id: 'reopened-updated', route: ROUTE, action: '重新挂载的 action 仍连接新 Provider，不更新已释放的实例', nodes: [...contextNodes('left', 1), ...contextNodes('right', 10)] },
    ])
    const page = await host!.reLaunch(WITHOUT_LAYOUT)
    await dom.check('without-layout', host!, page)
    await tapButton(page, 'increment-standalone')
    await dom.check('standalone-updated', host!, page)
    const reopened = await host!.reLaunch(ROUTE)
    await dom.check('reopened', host!, reopened)
    await tapButton(reopened, 'increment-left')
    await dom.check('reopened-updated', host!, reopened)
  })
})
