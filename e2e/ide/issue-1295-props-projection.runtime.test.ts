import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1295'
const ROUTE = '/pages/index/index'

const DIRECT_BINDINGS = ['change', 'selectA', 'selectB', 'localVisible', 'localResult', 'hasNext']

function bindingNodes(updated = false) {
  return [
    { selector: '#model-value', text: 'modelValue' },
    { selector: '#change', text: updated ? 'updated-change' : 'change' },
    { selector: '#select-a', text: updated ? 'updated-a' : 'selectA' },
    { selector: '#select-b', text: updated ? 'updated-b' : 'selectB' },
    { selector: '#local-visible', text: String(!updated) },
    { selector: '#local-result', text: updated ? 'updated-result' : 'localResult' },
    { selector: '#has-next', text: String(!updated) },
  ]
}

describe('issue #1295: mergeModels props projection', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let errors: RuntimeErrorCollector | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1295)
    await buildIssueRegressionProject(project, 'weapp')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([ROUTE.slice(1)])
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(project, `dist/pages/index/index.${extension}`))
    }
    const template = await readFile(path.join(project, 'dist/pages/index/index.wxml'), 'utf8')
    for (const binding of DIRECT_BINDINGS) {
      expect(template).toMatch(new RegExp(`id="[^"]+">\\{\\{\\s*${binding}\\s*\\}\\}</text>`))
    }
    expect(template).toMatch(/id="model-value"[^>]*>\{\{__wv_bind_\d+\}\}/)
    expect(new Set(template.match(/__wv_bind_\d+/g)).size).toBe(1)
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue1295-page'],
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

  it('renders and updates direct setup bindings, then restores initial state on reLaunch', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTE, action: '首次进入页面检查 mergeModels 投影后的真实绑定', nodes: bindingNodes() },
      { id: 'updated', route: ROUTE, action: '原生按钮同时更新直接绑定与计算值', nodes: bindingNodes(true) },
      { id: 'reopened', route: ROUTE, action: '复用会话重新进入页面，旧 model 和局部状态不残留', nodes: bindingNodes() },
    ])
    const page = await host!.reLaunch(ROUTE)
    await dom.check('initial', host!, page)
    const button = await page.$('#change-bindings')
    expect(button).toBeTruthy()
    await button!.tap()
    await dom.check('updated', host!, page)
    await dom.check('reopened', host!, await host!.reLaunch(ROUTE))
  })
})
