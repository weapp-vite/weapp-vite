import fs from 'node:fs/promises'
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

const ISSUE_ROUTE = '/pages/issue-829/index'

async function readDistText(...segments: string[]) {
  return await fs.readFile(path.join(DIST_ROOT, ...segments), 'utf8')
}

async function readScopedSlotWxml() {
  const pageDir = path.join(DIST_ROOT, 'pages/issue-829')
  const files = (await fs.readdir(pageDir))
    .filter(file => file.startsWith('index.__scoped-slot-default-') && file.endsWith('.wxml'))
  const contents = await Promise.all(files.map(async file => await fs.readFile(path.join(pageDir, file), 'utf8')))
  return contents.join('\n')
}

describe.sequential('e2e app: github-issues / issue #829', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('preserves function props for direct and nested scoped-slot components', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
        readiness: async (page) => {
          await page.waitForRendered({ selector: '#issue-829-page', timeout: 5_000 })
          return true
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-829 page')
      }

      await expect.poll(
        async () => await callRoutePageMethodWithOptions<Record<string, any>>(
          miniProgram,
          ISSUE_ROUTE,
          '_runE2E',
          {
            readiness: 'route',
            protocolTimeoutMs: 12_000,
            recoveryAttempts: 3,
            retries: 10,
          },
        ).catch(() => null),
        { timeout: 15_000, interval: 250 },
      ).toMatchObject({
        direct: {
          hasQueryFn: true,
          result: ['foo', 'bar'],
        },
        queryCallCount: 2,
      })

      const pageWxml = await readDistText('pages/issue-829/index.wxml')
      expect(pageWxml).toContain('query-fn="{{queryFn}}"')
      expect(await readScopedSlotWxml()).toContain('query-fn="{{__wvOwner.queryFn}}"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
