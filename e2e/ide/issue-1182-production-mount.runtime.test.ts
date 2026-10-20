import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

const fixture = 'e2e-apps/github-issues/fixtures/issue-1182'
const route = '/pages/index/index'
function nodes(value: number, identity = 'same') {
  return [
    { selector: '#mount-value', text: `value:${value}` },
    { selector: '#mount-setups', text: 'setups:1' },
    { selector: '#mount-identity', text: identity },
  ]
}

describe('issue #1182 production mount identity', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let launchAttempted = false
  const errors: string[] = []

  beforeAll(async () => {
    project = await createIssueRegressionProject(1182)
    await buildIssueRegressionProject(project, 'weapp')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([route.slice(1)])
    for (const extension of ['js', 'json', 'wxml']) {
      expect((await stat(path.join(project, 'dist', `${route.slice(1)}.${extension}`))).isFile()).toBe(true)
    }
    launchAttempted = true
    host = await launchAutomator({ projectPath: project, bridgeProjectMode: 'direct', warmupRoute: route }) as MiniProgram
    host.on('exception', event => errors.push(event.message))
  }, 180_000)

  afterAll(async () => {
    // 启动未返回宿主时保留项目，交给全局 journal 核验并完成资源清理。
    if (launchAttempted && !host) {
      return
    }
    await host?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 60_000)

  it('preserves the production instance and original reactive binding after repeated replacement mounts', async (context) => {
    const dom = createDomAcceptance(context, fixture, [
      { id: 'initial', route, action: '首屏挂载一次 setup 和原始响应式状态', nodes: nodes(1, 'initial') },
      { id: 'incremented', route, action: '原始 ref 在宿主中提交并渲染', nodes: nodes(2, 'initial') },
      { id: 'replaced', route, action: '重复挂载替换 app 不重复 setup，保留原实例和已提交状态', nodes: nodes(2) },
      { id: 'original-active', route, action: '重复挂载后原始 ref 继续更新真实页面', nodes: nodes(3) },
      { id: 'replacement-inactive', route, action: '未挂载的新 ref 不改变真实页面', nodes: nodes(3) },
      { id: 'repeated', route, action: '再次替换仍不重建生产实例', nodes: nodes(3) },
      { id: 'reopened', route, action: '重新进入页面创建新宿主和新的初始状态', nodes: nodes(1, 'initial') },
    ])
    const page = await host!.reLaunch(route)
    await dom.check('initial', host!, page)
    await page.callMethod('incrementOriginal')
    await dom.check('incremented', host!, page)
    await page.callMethod('replaceMount')
    await dom.check('replaced', host!, page)
    await page.callMethod('incrementOriginal')
    await dom.check('original-active', host!, page)
    await page.callMethod('incrementReplacement')
    await dom.check('replacement-inactive', host!, page)
    await page.callMethod('replaceMount')
    await dom.check('repeated', host!, page)
    const reopened = await host!.reLaunch(route)
    await dom.check('reopened', host!, reopened)
    expect(errors).toEqual([])
  })
})
