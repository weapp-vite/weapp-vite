import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssue1034Project, runIssue1034Command } from '../utils/issue1034Project'

const routes = ['/pages/home/index', '/subpackages/account/pages/detail/index', '/subpackages/isolated/pages/detail/index']
let project: string
let miniProgram: MiniProgram | undefined

describe('issue #1034: selected sources across package boundaries', { concurrent: false }, () => {
  beforeAll(async () => {
    project = await createIssue1034Project()
    await runIssue1034Command(project, 'build')
    for (const route of routes) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist${route}.${extension}`))
      }
    }
    miniProgram = await launchAutomator({ projectPath: project, warmupRoute: routes[0], warmupRootSelectors: ['#source'] })
  }, 180_000)

  afterAll(async () => {
    await miniProgram?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)

  it('navigates to each selected Vue page with its explicit sibling import and working events', async (context) => {
    const host = miniProgram!
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1034', routes.map((route, index) => ({
      id: `package-${index}`,
      route,
      action: '打开所选 Vue 页面并更新计数',
      nodes: [{ selector: '#source', text: `vue-business-${index}` }, { selector: '#increment', text: '1' }],
    })))
    for (const [index, route] of routes.entries()) {
      const page = await host.reLaunch(route)
      expect(page.path).toBe(route.slice(1))
      await expect.poll(async () => (await page.$('#source'))?.text()).toBe(`vue-business-${index}`)
      await (await page.$('#increment'))!.tap()
      await dom.check(`package-${index}`, host, page)
    }
  })
})
