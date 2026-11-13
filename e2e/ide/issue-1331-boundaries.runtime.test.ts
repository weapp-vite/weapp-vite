import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertAuthorIssueOutputs, buildAuthorIssueFixture, prepareAuthorIssueFixture } from '../utils/authorIssueFixture'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveIdeWarningReportPathsFromEnv } from '../utils/ideWarningReport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1331-review-boundaries'

describe('issue #1331 review initialization boundaries', () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await prepareAuthorIssueFixture(FIXTURE)
    const output = await buildAuthorIssueFixture(project, 'props')
    await assertAuthorIssueOutputs(output, ['pages/index/index', 'components/PureHost', 'components/PlainHost', 'components/StatusLabel', 'components/PureContract'])
    host = await launchAutomator({ projectPath: output, warmupRoute: '/pages/index/index', warmupRootSelectors: ['#boundary-root'] })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({ project, closeSession: async () => {
      await host?.close()
    }, stopDev: () => {} })
  })

  it('delivers the first setup value with pure data and ordinary setup on mount and reentry', async (context) => {
    const nodes = [
      { selector: '//*[@id="pure"]//text', query: 'xpath' as const, text: 'ready' },
      { selector: '//*[@id="plain"]//text', query: 'xpath' as const, text: 'ready' },
    ]
    const acceptance = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: '/pages/index/index', action: '冷启动审查提供的纯数据与普通 setup 输入', nodes },
      { id: 'reentry', route: '/pages/index/index', action: '重入并验证首次属性交付', nodes },
    ])
    async function assertDelivery(offset: number) {
      const snapshot = await host!.evaluate(() => (getApp() as any).globalData) as {
        initialPropsEvents: Array<{ probe: string, events: Array<{ phase: string, value?: string, previous?: string }> }>
        pureDataContract: unknown
      }
      // eslint-disable-next-line no-console
      console.log('initial property delivery', JSON.stringify(snapshot))
      const traces = snapshot.initialPropsEvents.slice(offset)
      expect(traces).toHaveLength(2)
      for (const probe of ['pure', 'plain']) {
        expect(traces.find(trace => trace.probe === probe)?.events).toEqual([
          { phase: 'created', value: '' },
          { phase: 'observer', value: 'ready', previous: '' },
          { phase: 'attached', value: 'ready' },
          { phase: 'ready', value: 'ready' },
        ])
      }
      expect(snapshot.pureDataContract).toEqual({ logic: 'updated-secret', property: 'incoming', propertyObserverCalls: 0, dataEvents: ['updated-secret'] })
    }

    await acceptance.check('initial', host!, (await host!.currentPage())!)
    await assertDelivery(0)
    await acceptance.check('reentry', host!, await host!.reLaunch('/pages/index/index'))
    await assertDelivery(2)
    const report = resolveIdeWarningReportPathsFromEnv()
    expect(report).not.toBeNull()
    const events = (await readFile(report!.eventLogPath, 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as { text?: string })
    expect(events.filter(event => /property.*text.*(?:type-uncompatible|expected.*String)/i.test(event.text ?? ''))).toEqual([])
  })
})
