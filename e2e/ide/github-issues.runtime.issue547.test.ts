import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

async function readDistWxml(relativePath: string) {
  return await fs.readFile(path.join(DIST_ROOT, relativePath), 'utf8')
}

describe.sequential('e2e app: github-issues / issue #547', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders nested augmented default slot content in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-547/index', undefined, 30_000, {
        readiness: async (page) => {
          await page.waitForRendered({
            selector: '#issue547-page',
            dataset: { e2eIssue: '547' },
            timeout: 2_500,
          })
          return true
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-547 page')
      }

      const pageWxml = await readDistWxml('pages/issue-547/index.wxml')
      expect(pageWxml).toContain('issue-547 nested augmented slot')
      expect(pageWxml).toContain('NestedSlotGroup')
      expect(pageWxml).toContain('generic:scoped-slots-default')

      const imageWxml = await readDistWxml('components/issue-547/NestedSlotImage/index.wxml')
      expect(imageWxml).toContain('issue-547 nested slot image')
      expect(imageWxml).toContain('data-issue547-image="true"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
