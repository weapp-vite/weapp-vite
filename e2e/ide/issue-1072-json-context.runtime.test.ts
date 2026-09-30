import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssue1072Project, runIssue1072Command } from '../utils/issue1072Project'

const routes = ['/pages/home/index', '/pages/external/index', '/pages/dynamic/index']
let project: string
let miniProgram: MiniProgram | undefined

describe('issue #1072: JSON context page runtime', { concurrent: false }, () => {
  beforeAll(async () => {
    project = await createIssue1072Project()
    await runIssue1072Command(project, 'build')
    for (const route of routes) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist${route}.${extension}`))
      }
    }
    miniProgram = await launchAutomator({ projectPath: project, warmupRoute: routes[0], warmupRootSelectors: ['#increment'] })
  }, 180_000)

  afterAll(async () => {
    await miniProgram?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)

  it('navigates to metadata-configured pages with working reactive events', async (context) => {
    const host = miniProgram!
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1072', routes.map((route, index) => ({
      id: `package-${index}`,
      route,
      action: '打开经元信息配置的页面并更新计数',
      nodes: [{ selector: '#increment', text: '1' }],
    })))
    for (const [index, route] of routes.entries()) {
      const page = await host.reLaunch(route)
      expect(page.path).toBe(route.slice(1))
      await expect.poll(async () => (await page.$('#increment'))?.text()).toBe('0')
      await (await page.$('#increment'))!.tap()
      await dom.check(`package-${index}`, host, page)
    }
  })
})
