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

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1261'
const ROUTE = '/pages/index/index'

function navNodes(current: number, max: number) {
  return [
    { scope: ['#nav-probe'], selector: '#nav-position', text: `${current}/${max}` },
    { scope: ['#nav-probe'], selector: '#next', attributes: { disabled: String(current >= max) } },
    { scope: ['#nav-probe'], selector: '#previous', attributes: { disabled: String(current <= 1) } },
  ]
}

function canvasNodes(probe: string, local: string, parent: string) {
  return [
    { scope: [`#${probe}-probe`], selector: '#local-canvas', text: local },
    { scope: [`#${probe}-probe`], selector: '#parent-canvas', text: parent },
  ]
}

async function tapComponentButton(page: Awaited<ReturnType<MiniProgram['reLaunch']>>, component: string, selector: string) {
  const probe = await page.$(component)
  expect(probe).toBeTruthy()
  const button = await probe!.$(selector)
  expect(button).toBeTruthy()
  await button!.tap()
}

describe('issue #1261: precise setup prop projection', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let errors: RuntimeErrorCollector | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1261)
    await buildIssueRegressionProject(project, 'weapp')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([ROUTE.slice(1)])
    const pageJson = JSON.parse(await readFile(path.join(project, 'dist/pages/index/index.json'), 'utf8')) as {
      usingComponents: Record<string, string>
    }
    const componentEntries = Object.values(pageJson.usingComponents).map((entry) => {
      return entry.startsWith('/') ? entry.slice(1) : path.posix.join('pages/index', entry)
    })
    for (const entry of [...app.pages, ...componentEntries]) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, 'dist', `${entry}.${extension}`))
      }
    }
    const templates = await Promise.all(componentEntries.map(async (entry) => {
      return await readFile(path.join(project!, 'dist', `${entry}.wxml`), 'utf8')
    }))
    const navigation = templates.find(template => template.includes('id="nav-position"'))
    expect(navigation).toBeDefined()
    expect(navigation).toMatch(/disabled="\{\{\s*!haveNext\s*\}\}"/)
    expect(navigation).toMatch(/disabled="\{\{\s*!havePrev\s*\}\}"/)
    expect(navigation).not.toMatch(/__wv_bind_\d+/)
    const conflicts = templates.filter(template => template.includes('id="local-canvas"'))
    expect(conflicts).toHaveLength(2)
    for (const template of conflicts) {
      expect(template).toMatch(/<text\b[^>]+\bid="local-canvas"[^>]*>\{\{\s*__wv_bind_\d+\s*\}\}/)
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue1261-page'],
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

  it('updates direct frozen-prop navigation bindings and resets them on reLaunch', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTE, action: '冻结 props 的非冲突绑定首次渲染，上一页禁用', nodes: navNodes(1, 3) },
      { id: 'next', route: ROUTE, action: '点击下一页更新直接绑定和按钮状态', nodes: navNodes(2, 3) },
      { id: 'last', route: ROUTE, action: '到达末页后下一页禁用', nodes: navNodes(3, 3) },
      { id: 'extended', route: ROUTE, action: '父组件增加 max，当前页保留且下一页恢复', nodes: navNodes(3, 4) },
      { id: 'previous', route: ROUTE, action: '父属性更新后仍可返回上一页', nodes: navNodes(2, 4) },
      { id: 'reopened', route: ROUTE, action: '重新进入页面恢复独立的父子初值', nodes: navNodes(1, 3) },
    ])
    const page = await host!.reLaunch(ROUTE)
    await dom.check('initial', host!, page)
    await tapComponentButton(page, '#nav-probe', '#next')
    await dom.check('next', host!, page)
    await tapComponentButton(page, '#nav-probe', '#next')
    await dom.check('last', host!, page)
    await page.callMethod('extendMax')
    await dom.check('extended', host!, page)
    await tapComponentButton(page, '#nav-probe', '#previous')
    await dom.check('previous', host!, page)
    const reopened = await host!.reLaunch(ROUTE)
    await dom.check('reopened', host!, reopened)
  })

  for (const probe of ['conflict', 'mutable']) {
    it(`keeps local state separate from parent props for ${probe} declarations`, async (context) => {
      const dom = createDomAcceptance(context, FIXTURE, [
        { id: 'initial', route: ROUTE, action: '真实同名 prop 与 setup 状态首次保持各自值', nodes: canvasNodes(probe, 'local-canvas', 'parent-canvas') },
        { id: 'parent', route: ROUTE, action: '父属性更新不覆盖局部 setup 状态', nodes: canvasNodes(probe, 'local-canvas', 'updated-parent') },
        { id: 'local', route: ROUTE, action: '局部状态更新不回写宿主 prop', nodes: canvasNodes(probe, 'changed-local', 'updated-parent') },
        { id: 'reopened', route: ROUTE, action: '重新进入页面释放旧局部值并恢复父级初值', nodes: canvasNodes(probe, 'local-canvas', 'parent-canvas') },
      ])
      const page = await host!.reLaunch(ROUTE)
      await dom.check('initial', host!, page)
      await page.callMethod('updateParentCanvas')
      await dom.check('parent', host!, page)
      await tapComponentButton(page, `#${probe}-probe`, '#change-local')
      await dom.check('local', host!, page)
      const reopened = await host!.reLaunch(ROUTE)
      await dom.check('reopened', host!, reopened)
    })
  }
})
