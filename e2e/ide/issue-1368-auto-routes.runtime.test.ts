import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prepareAuthorIssueFixture } from '../utils/authorIssueFixture'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { assertIssuePageArtifacts, startIssueClassicDev, waitForIssuePublication } from '../utils/issueClassicDev'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1368'
const ROUTE = '/pages/goal/index'

describe('issue #1368 auto-routes excludes test files', () => {
  let project: string | undefined
  let dev: ReturnType<typeof startIssueClassicDev> | undefined
  let host: MiniProgram | undefined

  beforeAll(async () => {
    project = await prepareAuthorIssueFixture(FIXTURE)
    dev = startIssueClassicDev(project)
    await waitForIssuePublication(project, dev)

    const app = await assertIssuePageArtifacts(project)
    expect(app.pages).toEqual(['pages/goal/index'])
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(project, `dist/pages/goal/index.${extension}`))
    }
    await expect(readFile(path.join(project, 'dist/app.json'), 'utf8')).resolves.not.toContain('goal/__tests__')
    host = await launchAutomator({
      projectPath: project,
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue1368-page'],
    })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: async () => { await host?.close() },
      stopDev: () => dev?.stop(5_000),
    })
  }, 120_000)

  it('loads the valid page in DevTools with no test route in the app manifest', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [{
      id: 'page',
      route: '/pages/goal/index',
      action: '打开 issue 1368 的真实页面',
      nodes: [{ selector: '#issue1368-page', text: 'Issue 1368' }],
    }])
    const page = await host!.currentPage()
    expect(page.path).toBe(ROUTE.slice(1))
    await dom.check('page', host!, page)
  })
})
