import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethodWithOptions,
  closeSharedMiniProgram,
  delay,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_581_ROUTE = '/pages/issue-581/index'
const ISSUE_581_RENDER_TIMEOUT = 8_000
const ISSUE_581_EXPECTED_ROWS = ['init', '123', '456']
const ISSUE_581_ROUTE_METHOD_OPTIONS = {
  protocolTimeoutMs: 30_000,
  retries: 1,
  recoveryAttempts: 2,
}

async function waitForIssue581Rows(miniProgram: any, expectedRows = ISSUE_581_EXPECTED_ROWS) {
  const start = Date.now()
  let latestRuntime: any

  while (Date.now() - start <= ISSUE_581_RENDER_TIMEOUT) {
    latestRuntime = await callRoutePageMethodWithOptions<Record<string, any>>(
      miniProgram,
      ISSUE_581_ROUTE,
      '_runE2E',
      ISSUE_581_ROUTE_METHOD_OPTIONS,
    )
    if (
      latestRuntime?.loading === false
      && Array.isArray(latestRuntime.rows)
      && latestRuntime.rows.length === expectedRows.length
      && expectedRows.every((row, index) => latestRuntime.rows[index] === row)
    ) {
      return { runtime: latestRuntime }
    }

    await delay(220)
  }

  return { runtime: latestRuntime }
}

async function appendIssue581Rows(miniProgram: any, names: string[]) {
  return await callRoutePageMethodWithOptions<Record<string, any>>(
    miniProgram,
    ISSUE_581_ROUTE,
    '_appendIssue581Rows',
    ISSUE_581_ROUTE_METHOD_OPTIONS,
    names,
  )
}

async function expectIssue581DistWxmlContract() {
  const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-581/index.wxml'), 'utf8')
  expect(pageWxml).toContain('issue-581 reactive array flush')
  expect(pageWxml).toContain('data-loading="{{back.loading ? \'true\' : \'false\'}}"')
  expect(pageWxml).toContain('data-row-count="{{back.state.length}}"')
  expect(pageWxml).toContain('wx:for="{{back.state}}"')
  expect(pageWxml).toContain('data-issue581-name="{{value.name}}"')
}

describe.sequential('e2e app: github-issues / issue #581', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders reactive array pushes after a sibling setup ref flushes first in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_581_ROUTE, undefined, 45_000, {
        readiness: 'route',
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-581 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)

      const { runtime } = await waitForIssue581Rows(activeMiniProgram)

      expect(runtime).toMatchObject({
        ok: true,
        issue: 581,
        loading: false,
        flushCount: 1,
        rows: ISSUE_581_EXPECTED_ROWS,
      })
      await expectIssue581DistWxmlContract()
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('keeps repeated setup object requeues visible across multiple DevTools flushes', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_581_ROUTE, undefined, 45_000, {
        readiness: 'route',
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-581 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)

      await waitForIssue581Rows(activeMiniProgram)

      await appendIssue581Rows(activeMiniProgram, ['789', '999'])
      const secondRows = [...ISSUE_581_EXPECTED_ROWS, '789', '999']
      const secondResult = await waitForIssue581Rows(activeMiniProgram, secondRows)
      expect(secondResult.runtime).toMatchObject({
        ok: true,
        issue: 581,
        loading: false,
        flushCount: 2,
        rows: secondRows,
      })

      await appendIssue581Rows(activeMiniProgram, ['abc'])
      const thirdRows = [...secondRows, 'abc']
      const thirdResult = await waitForIssue581Rows(activeMiniProgram, thirdRows)
      expect(thirdResult.runtime).toMatchObject({
        ok: true,
        issue: 581,
        loading: false,
        flushCount: 3,
        rows: thirdRows,
      })
      await expectIssue581DistWxmlContract()
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
