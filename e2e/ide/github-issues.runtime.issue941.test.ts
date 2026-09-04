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
} from './github-issues.runtime.shared'

const ISSUE_941_ROUTE = '/pages/issue-941/index'

describe('e2e app: github-issues / issue #941', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-941/index.js',
      'pages/issue-941/index.json',
      'pages/issue-941/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('keeps every wx direct-return API out of the Promise bridge', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, ISSUE_941_ROUTE, undefined, 45_000, {
      readiness: async (targetPage) => {
        await targetPage.waitForRendered({ selector: '#issue-941-page', timeout: 5_000 })
        return true
      },
    })
    expect(page).toBeTruthy()

    const result = await page?.callMethodWithOptions('_runE2E', { protocolTimeoutMs: 8_000 })
    expect(result.resultMethods).toHaveLength(14)
    expect(result.resultMethods.every((item: any) => item.sameIdentity && !item.isPromise)).toBe(true)
    expect(result.voidMethods).toHaveLength(7)
    expect(result.voidMethods.every((item: any) => item.isUndefined && !item.isPromise)).toBe(true)
    expect(result.cacheManagerOptions).toEqual(['maxSize'])
  })
})
