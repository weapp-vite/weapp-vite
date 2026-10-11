import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssue1185Project, createIssue1185Project } from '../utils/issue1185Project'

let project: string
let miniProgram: MiniProgram | undefined

describe('issue #1185: Vue entries with sibling scripts', { concurrent: false }, () => {
  beforeAll(async () => {
    project = await createIssue1185Project()
    await buildIssue1185Project(project)
    for (const entry of ['pages/component/index', 'components/foo/foo', 'pages/bar/bar', 'pages/unused/unused']) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist/${entry}.${extension}`))
      }
    }
    const files = await readdir(path.join(project, 'dist'))
    expect(files).not.toContain('foo.js')
    expect(files).not.toContain('bar.js')
    miniProgram = await launchAutomator({
      projectPath: project,
      // fixture 已复制到本轮独立目录，直接验收 Vite 写出的产物，无需第二份项目快照。
      bridgeProjectMode: 'direct',
      warmupRoute: '/pages/component/index',
      warmupRootSelectors: ['#component-page'],
    })
  }, 180_000)

  afterAll(async () => {
    await miniProgram?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 120_000)

  it('renders and updates a component explicitly imported with its Vue extension', async (context) => {
    const route = '/pages/component/index'
    const host = miniProgram!
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1185', [0, 1].map(count => ({
      id: `component-${count}`,
      route,
      action: `检查同名脚本导入组件的数值与第 ${count} 次更新`,
      nodes: [
        { scope: ['#foo'], selector: '#foo-values', text: '1/2' },
        { scope: ['#foo'], selector: '#foo-increment', text: String(count) },
      ],
    })))
    const page = await host.reLaunch(route)
    await dom.check('component-0', host, page)
    const foo = await page.$('#foo')
    expect(foo).toBeDefined()
    const button = await foo!.$('#foo-increment')
    expect(button).toBeDefined()
    await button!.tap()
    await dom.check('component-1', host, page)
  })

  it('renders and updates the selected Vue page with its same-named TS import', async (context) => {
    const route = '/pages/bar/bar'
    const host = miniProgram!
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1185', [0, 1].map(count => ({
      id: `page-${count}`,
      route,
      action: `检查所选 Vue 页面的数值与第 ${count} 次更新`,
      nodes: [{ selector: '#bar-values', text: '1/2' }, { selector: '#bar-increment', text: String(count) }],
    })))
    const page = await host.reLaunch(route)
    expect(page.path).toBe(route.slice(1))
    await dom.check('page-0', host, page)
    await (await page.$('#bar-increment'))!.tap()
    await dom.check('page-1', host, page)
  })

  it('ignores a same-named TS file that the Vue page does not import', async (context) => {
    const route = '/pages/unused/unused'
    const host = miniProgram!
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1185', [{
      id: 'unused-sibling',
      route,
      action: '检查未导入的同名 TS 不影响 Vue 页面',
      nodes: [{ selector: '#unused-value', text: '7' }],
    }])
    const page = await host.reLaunch(route)
    await dom.check('unused-sibling', host, page)
  })
})
