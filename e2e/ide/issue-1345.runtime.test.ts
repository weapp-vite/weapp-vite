import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertAuthorIssueOutputs, buildAuthorIssueFixture, prepareAuthorIssueFixture } from '../utils/authorIssueFixture'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1345-wxss-charset'
const ROUTE = '/pages/index/index'

describe('issue #1345 WXSS charset output', () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await prepareAuthorIssueFixture(FIXTURE)
    const output = await buildAuthorIssueFixture(project, 'default')
    await assertAuthorIssueOutputs(output, ['pages/index/index'])
    const wxss = await readFile(path.join(output, 'pages/index/index.wxss'), 'utf8')
    expect(wxss).not.toMatch(/^\uFEFF?@charset\b/im)
    expect(wxss).toContain('color: red')
    host = await launchAutomator({
      projectPath: output,
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue-1345-probe'],
    })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: async () => { await host?.close() },
      stopDev: () => {},
    })
  })

  it('renders the styled probe on first mount and reentry', async (context) => {
    const visual = resolveRuntimeProviderName() === 'devtools'
    const node = {
      selector: '#issue-1345-probe',
      text: 'issue 1345',
      ...(visual ? { styles: { color: 'rgb(255, 0, 0)' }, visible: true } : {}),
    }
    const acceptance = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTE, action: '检查包含中文 SCSS 注释的页面样式首次生效', nodes: [node] },
      { id: 'reentry', route: ROUTE, action: '重新进入后保留页面样式', nodes: [node] },
    ])
    await acceptance.check('initial', host!, (await host!.currentPage())!)
    await acceptance.check('reentry', host!, await host!.reLaunch(ROUTE))
  })
})
