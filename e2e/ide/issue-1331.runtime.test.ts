import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertAuthorIssueOutputs, buildAuthorIssueFixture, prepareAuthorIssueFixture } from '../utils/authorIssueFixture'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveIdeWarningReportPathsFromEnv } from '../utils/ideWarningReport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const PROPS = 'e2e-apps/github-issues/fixtures/issue-1331-initial-props'

describe('issue #1331 author required String initial properties', () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await prepareAuthorIssueFixture(PROPS)
    const output = await buildAuthorIssueFixture(project, 'props')
    await assertAuthorIssueOutputs(output, ['pages/raw/index', 'pages/guarded/index', 'components/StatusLabel'])
    host = await launchAutomator({ projectPath: output, warmupRoute: '/pages/raw/index', warmupRootSelectors: ['#literal'] })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: async () => { await host?.close() },
      stopDev: () => {},
    })
  })

  it('publishes synchronous setup state before first property delivery and after reentry', async (context) => {
    const nodes = [
      { selector: '//*[@id="literal"]//text', query: 'xpath' as const, text: '字面量初值' },
      { selector: '//*[@id="computed"]//text', query: 'xpath' as const, text: '就绪' },
      { selector: '//*[@id="factory"]//text', query: 'xpath' as const, text: '工厂初值' },
    ]
    const acceptance = createDomAcceptance(context, PROPS, [
      { id: 'raw-initial', route: '/pages/raw/index', action: '冷启动原始无兜底页面', nodes },
      { id: 'guarded', route: '/pages/guarded/index', action: '进入作者模板兜底对照页', nodes },
      { id: 'raw-remounted', route: '/pages/raw/index', action: '返回无兜底页面验证首次属性交付', nodes },
    ])
    await acceptance.check('raw-initial', host!, (await host!.currentPage())!)
    await acceptance.check('guarded', host!, await host!.reLaunch('/pages/guarded/index'))
    await acceptance.check('raw-remounted', host!, await host!.reLaunch('/pages/raw/index'))
    const report = resolveIdeWarningReportPathsFromEnv()
    expect(report).not.toBeNull()
    const events = (await readFile(report!.eventLogPath, 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as { text?: string })
    expect(events.filter(event => /property.*text.*(?:type-uncompatible|expected.*String)/i.test(event.text ?? ''))).toEqual([])
  })
})
