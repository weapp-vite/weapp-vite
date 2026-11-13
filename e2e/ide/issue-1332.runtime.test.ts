import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertAuthorIssueOutputs, buildAuthorIssueFixture, prepareAuthorIssueFixture } from '../utils/authorIssueFixture'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const EXTERNAL = 'e2e-apps/github-issues/fixtures/issue-1332-external-script'
const INDEX = '/pages/index/index'

describe('issue #1332 author external setup component imports', () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await prepareAuthorIssueFixture(EXTERNAL)
    const output = await buildAuthorIssueFixture(project, 'production')
    await assertAuthorIssueOutputs(output, ['pages/index/index', 'shared/components/ReproLabel'])
    const page = JSON.parse(await readFile(path.join(output, 'pages/index/index.json'), 'utf8')) as { usingComponents?: Record<string, string> }
    expect(page.usingComponents?.['repro-label']).toBe('/shared/components/ReproLabel')
    host = await launchAutomator({ projectPath: output, warmupRoute: INDEX })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: async () => { await host?.close() },
      stopDev: () => {},
    })
  })

  it('registers and renders the original shared component on mount and reentry', async (context) => {
    const nodes = [{ selector: '//text', query: 'xpath' as const, text: '来自共享目录的组件' }]
    const acceptance = createDomAcceptance(context, EXTERNAL, [
      { id: 'initial', route: INDEX, action: '渲染外部脚本导入的共享组件', nodes },
      { id: 'remounted', route: INDEX, action: '重新进入并保持组件来源', nodes },
    ])
    await acceptance.check('initial', host!, (await host!.currentPage())!)
    await acceptance.check('remounted', host!, await host!.reLaunch(INDEX))
  })
})
