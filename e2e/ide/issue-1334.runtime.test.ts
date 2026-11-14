import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertAuthorIssueOutputs, buildAuthorIssueFixture, prepareAuthorIssueFixture } from '../utils/authorIssueFixture'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1334-mustache-object-fallback'
const ROUTE = '/pages/index/index'

describe('issue #1334 compact mustache object fallback', () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await prepareAuthorIssueFixture(FIXTURE)
    const compact = await buildAuthorIssueFixture(project, 'default')
    const spaced = await buildAuthorIssueFixture(project, 'spaced')
    await assertAuthorIssueOutputs(compact, ['pages/index/index', 'components/ResultPreview'])
    await assertAuthorIssueOutputs(spaced, ['pages/index/index', 'components/ResultPreview'])

    const compactWxml = await readFile(path.join(compact, 'pages/index/index.wxml'), 'utf8')
    const spacedWxml = await readFile(path.join(spaced, 'pages/index/index.wxml'), 'utf8')
    expect(compactWxml).toContain('preview="{{preview || { rawValueText: \'—\', valueText: \'—\' } }}"')
    expect(compactWxml).not.toContain('preview="{{preview || { rawValueText: \'—\', valueText: \'—\' }}}"')
    expect(spacedWxml).toContain('preview="{{ preview || { rawValueText: \'—\', valueText: \'—\' } }}"')
    expect(compactWxml.replace(/\s/gu, '')).toBe(spacedWxml.replace(/\s/gu, ''))
    host = await launchAutomator({
      projectPath: compact,
      warmupRoute: ROUTE,
    })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: async () => { await host?.close() },
      stopDev: () => {},
    })
  })

  it('renders both object fallback values on first mount and reentry', async (context) => {
    const acceptance = createDomAcceptance(context, FIXTURE, [
      {
        id: 'initial',
        route: ROUTE,
        action: '检查对象兜底表达式首次渲染结果',
        nodes: [
          { selector: '//text', query: 'xpath', count: 2, text: '—' },
        ],
      },
      {
        id: 'reentry',
        route: ROUTE,
        action: '重新进入后保留对象兜底表达式结果',
        nodes: [
          { selector: '//text', query: 'xpath', count: 2, text: '—' },
        ],
      },
    ])
    await acceptance.check('initial', host!, (await host!.currentPage())!)
    await acceptance.check('reentry', host!, await host!.reLaunch(ROUTE))
  })
})
