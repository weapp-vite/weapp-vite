import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethodWithOptions,
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_554_ROUTE = '/pages/issue-554/index'
const ISSUE_554_EXPECTED_IMAGE = '/assets/images/home/goods-1.png'
const ISSUE_554_ROUTE_METHOD_OPTIONS = {
  protocolTimeoutMs: 30_000,
  retries: 1,
  recoveryAttempts: 2,
}

describe.sequential('e2e app: github-issues / issue #554', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders default slot content from components with v-for in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_554_ROUTE, undefined, 45_000, {
        readiness: 'route',
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-554 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)

      const runtime = await callRoutePageMethodWithOptions<Record<string, any>>(
        activeMiniProgram,
        ISSUE_554_ROUTE,
        '_runE2E',
        ISSUE_554_ROUTE_METHOD_OPTIONS,
      )
      expect(runtime).toMatchObject({
        expected: ISSUE_554_EXPECTED_IMAGE,
        itemCount: 1,
        ok: true,
      })
      expect(runtime.runtimeItems).toEqual([
        {
          key: 'cover-a',
          src: ISSUE_554_EXPECTED_IMAGE,
        },
      ])
      expect(runtime.slotMetadata).toEqual([
        {
          default: true,
        },
      ])

      const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-554/index.wxml'), 'utf8')
      expect(pageWxml).toContain('<LoopSlotCell')
      expect(pageWxml).toContain('vue-slots="{{__wv_bind_0[__wv_index_1]}}"')
      expect(pageWxml).toContain('class="issue554-image"')
      expect(pageWxml).toContain(`src="{{__wv_item_0.src}}"`)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
