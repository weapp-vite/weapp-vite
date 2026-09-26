import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssue997, createIssue997Project, ISSUE_997_OUTPUTS } from '../utils/issue997Build'

const ROUTE = '/pages/index/index'
let project: string
let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

describe('issue #997: rebuild while the host remains open', () => {
  beforeAll(async () => {
    project = await createIssue997Project()
    await buildIssue997(project, { preserve: true })
    miniProgram = await launchAutomator({
      projectPath: project,
      // 必须让 IDE 直接读取被重建的目录，产物副本会掩盖文件缺失窗口。
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue-997-page'],
    })
  }, 180_000)

  afterAll(async () => {
    await miniProgram?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)

  it('keeps generated files available and renders an interactive page after rebuilding', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-997', [
      { id: 'initial', route: ROUTE, action: '重建前确认宿主页', nodes: [{ selector: '#issue-997-page', text: 'output preserved' }] },
      { id: 'rebuilt', route: ROUTE, action: 'IDE 保持打开时重建后验证页面和点击', nodes: [{ selector: '#issue-997-page', text: 'output preserved' }, { selector: '#increment', text: '1' }] },
    ])
    const host = miniProgram!
    const initial = await host.reLaunch(ROUTE)
    await dom.check('initial', host, initial)
    expect(await buildIssue997(project, { preserve: true, verify: true })).toEqual([])
    for (const file of ISSUE_997_OUTPUTS) {
      expect(existsSync(path.join(project, file)), file).toBe(true)
    }
    const page = await host.reLaunch(ROUTE)
    await page.waitForRendered({ selector: '#increment', timeout: 30_000 })
    const button = await page.$('#increment')
    await button!.tap()
    await dom.check('rebuilt', host, page)
  })
})
