import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assertAuthorIssueOutputs, buildAuthorIssueFixture, prepareAuthorIssueFixture } from '../utils/authorIssueFixture'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const FORMAT = 'e2e-apps/github-issues/fixtures/issue-1330-format-wxml'
const INDEX = '/pages/index/index'

describe('issue #1330 author nested text formatting', () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await prepareAuthorIssueFixture(FORMAT)
    const formatted = await buildAuthorIssueFixture(project, 'formatted')
    const compact = await buildAuthorIssueFixture(project, 'compact')
    for (const output of [formatted, compact]) {
      await assertAuthorIssueOutputs(output, ['pages/index/index'])
    }
    const content = async (output: string) => {
      const template = await readFile(path.join(output, 'pages/index/index.wxml'), 'utf8')
      return template.match(/<text id="actual">([\s\S]*?)<\/text>\s*<\/view>/)?.[1]
    }
    expect(await content(formatted)).toBe(await content(compact))
    expect(await content(formatted)).toBe('总重：<text>{{weight}}</text>kg')
    host = await launchAutomator({ projectPath: formatted, warmupRoute: INDEX, warmupRootSelectors: ['#actual'] })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: async () => { await host?.close() },
      stopDev: () => {},
    })
  })

  it('preserves exact rendered text on first mount and reentry', async (context) => {
    const nodes = [
      { selector: '#actual', text: '总重：123kg', textWhitespace: 'preserve' as const },
      { selector: '#reference', text: '总重：123kg', textWhitespace: 'preserve' as const },
    ]
    const acceptance = createDomAcceptance(context, FORMAT, [
      { id: 'initial', route: INDEX, action: '比较嵌套文本与原始参考文本', nodes },
      { id: 'remounted', route: INDEX, action: '重新进入后保留精确空白', nodes },
    ])
    await acceptance.check('initial', host!, (await host!.currentPage())!)
    await acceptance.check('remounted', host!, await host!.reLaunch(INDEX))
  })
})
