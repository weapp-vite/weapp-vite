import fs from 'node:fs/promises'
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

const ISSUE_ROUTE = '/pages/issue-829/index'

async function readDistText(...segments: string[]) {
  return await fs.readFile(path.join(DIST_ROOT, ...segments), 'utf8')
}

async function waitForQueryResult(page: any, selector: string, timeoutMs = 12_000) {
  const startedAt = Date.now()
  let latest = ''
  while (Date.now() - startedAt <= timeoutMs) {
    const element = await page.$(selector, { timeout: 1_000 }).catch(() => undefined)
    latest = String(await element?.text().catch(() => '') ?? '')
    if (latest.includes('foo,bar')) {
      return latest
    }
    await page.waitFor?.(160)
    if (typeof page.waitFor !== 'function') {
      await new Promise(resolve => setTimeout(resolve, 160))
    }
  }
  throw new Error(`Timed out waiting for ${selector} to render query data; latest=${latest}`)
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
        () => waitForQueryResult(issuePage, '.issue829-direct-result', 1_000).catch(() => ''),
        { timeout: 15_000, interval: 250 },
      ).toContain('Result: foo,bar')
      await expect.poll(
        () => waitForQueryResult(issuePage, '.issue829-nested-result', 1_000).catch(() => ''),
        { timeout: 15_000, interval: 250 },
      ).toContain('Result: foo,bar')

      const pageWxml = await readDistText('pages/issue-829/index.wxml')
      expect(pageWxml).toContain('__wvOwner.queryFn')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
