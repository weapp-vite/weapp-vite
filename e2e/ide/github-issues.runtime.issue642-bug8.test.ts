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

const ISSUE_642_BUG8_ROUTE = '/pages/issue-642-bug8/index'
const ISSUE_642_BUG8_ROUTE_METHOD_OPTIONS = {
  protocolTimeoutMs: 30_000,
  retries: 1,
  recoveryAttempts: 2,
}

async function waitForIssue642Bug8Runtime(miniProgram: any, timeoutMs = 8_000) {
  const startedAt = Date.now()
  let latest: any

  while (Date.now() - startedAt < timeoutMs) {
    latest = await callRoutePageMethodWithOptions<Record<string, any>>(
      miniProgram,
      ISSUE_642_BUG8_ROUTE,
      '_runE2E',
      ISSUE_642_BUG8_ROUTE_METHOD_OPTIONS,
    )
    const ownerReady = typeof latest?.owner?.dataOwnerId === 'string'
      && latest.owner.dataOwnerId.length > 0
      && latest.owner.runtimeOwnerId === latest.owner.dataOwnerId
    const directReady = latest?.direct?.dataSlotOwnerId === latest?.owner?.dataOwnerId
      && latest?.direct?.propsSlotOwnerId === latest?.owner?.dataOwnerId
    const wrapOwnerReady = typeof latest?.wrap?.owner?.dataOwnerId === 'string'
      && latest.wrap.owner.dataOwnerId.length > 0
      && latest.wrap.owner.runtimeOwnerId === latest.wrap.owner.dataOwnerId
    const wrappedReady = latest?.wrap?.child?.dataSlotOwnerId === latest?.wrap?.owner?.dataOwnerId
      && latest?.wrap?.child?.propsSlotOwnerId === latest?.wrap?.owner?.dataOwnerId

    if (ownerReady && directReady && wrapOwnerReady && wrappedReady) {
      return latest
    }

    await delay(160)
  }

  return latest
}

async function expectIssue642Bug8DistWxmlContract() {
  const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-642-bug8/index.wxml'), 'utf8')
  const wrapWxml = await fs.readFile(path.join(DIST_ROOT, 'components/issue-642-bug8/Wrap/index.wxml'), 'utf8')
  const directSlotWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-642-bug8/index.__scoped-slot-default-0.wxml'), 'utf8')
  const wrappedSlotWxml = await fs.readFile(path.join(DIST_ROOT, 'components/issue-642-bug8/Wrap/index.__scoped-slot-default-0.wxml'), 'utf8')

  expect(pageWxml).toContain('id="issue642-bug8-direct-cell"')
  expect(pageWxml).toContain('generic:scoped-slots-default=')
  expect(pageWxml).toContain('vue-slots="{{ {default:true} }}"')
  expect(pageWxml).toContain('__wvSlotOwnerId="{{__wvSlotOwnerId || __wvOwnerId || \'\'}}"')
  expect(pageWxml).toContain('<Issue642Bug8Wrap id="issue642-bug8-wrap"')

  expect(wrapWxml).toContain('id="issue642-bug8-wrapped-cell"')
  expect(wrapWxml).toContain('generic:scoped-slots-default=')
  expect(wrapWxml).toContain('vue-slots="{{ {default:true} }}"')
  expect(wrapWxml).toContain('__wvSlotOwnerId="{{__wvSlotOwnerId || __wvOwnerId || \'\'}}"')

  expect(directSlotWxml).toContain('data-issue642-bug8-case="direct"')
  expect(directSlotWxml).toContain('data-issue642-bug8-value="{{__wvSlotPropsData.io}}"')
  expect(directSlotWxml).toContain('{{__wvSlotPropsData.io}}')
  expect(wrappedSlotWxml).toContain('data-issue642-bug8-case="wrapped"')
  expect(wrappedSlotWxml).toContain('data-issue642-bug8-value="{{__wvSlotPropsData.io}}"')
  expect(wrappedSlotWxml).toContain('{{__wvSlotPropsData.io}}')
}

describe.sequential('e2e app: github-issues / issue #642 bug-8', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps scoped slot owner id when scoped slot component is nested through another component', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_642_BUG8_ROUTE, undefined, 45_000, {
        readiness: async (page) => {
          await page.waitForRendered({
            selector: '#issue642-bug8-page',
            dataset: { e2eIssue: '642-bug8' },
            timeout: 4_000,
          })
          return true
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-642-bug8 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)

      const runtime = await waitForIssue642Bug8Runtime(activeMiniProgram)
      expect(runtime).toMatchObject({
        owner: {
          dataOwnerId: expect.any(String),
          runtimeOwnerId: expect.any(String),
        },
        direct: {
          dataSlotOwnerId: expect.any(String),
          propsSlotOwnerId: expect.any(String),
        },
        wrap: {
          owner: {
            dataOwnerId: expect.any(String),
            runtimeOwnerId: expect.any(String),
          },
          child: {
            dataSlotOwnerId: expect.any(String),
            propsSlotOwnerId: expect.any(String),
          },
        },
      })
      expect(runtime.owner.dataOwnerId).not.toBe('')
      expect(runtime.direct.dataSlotOwnerId).toBe(runtime.owner.dataOwnerId)
      expect(runtime.direct.propsSlotOwnerId).toBe(runtime.owner.dataOwnerId)
      expect(runtime.wrap.owner.dataOwnerId).not.toBe('')
      expect(runtime.wrap.owner.dataOwnerId).not.toBe(runtime.owner.dataOwnerId)
      expect(runtime.wrap.owner.runtimeOwnerId).toBe(runtime.wrap.owner.dataOwnerId)
      expect(runtime.wrap.child.dataSlotOwnerId).toBe(runtime.wrap.owner.dataOwnerId)
      expect(runtime.wrap.child.propsSlotOwnerId).toBe(runtime.wrap.owner.dataOwnerId)
      await expectIssue642Bug8DistWxmlContract()
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
