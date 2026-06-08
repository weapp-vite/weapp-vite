import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  delay,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

async function waitForIssue642Bug8Runtime(page: any, timeoutMs = 8_000) {
  const startedAt = Date.now()
  let latest: any

  while (Date.now() - startedAt < timeoutMs) {
    latest = await page.callMethod('_runE2E')
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

async function readRenderedCase(page: any, name: 'direct' | 'wrapped') {
  const element = await page.$(`[data-issue642-bug8-case="${name}"]`)
  return {
    exists: Boolean(element),
    text: element ? (await element.text()).trim() : '',
    value: element ? await element.attribute('data-issue642-bug8-value') : undefined,
  }
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-642-bug8/index', '123')
      if (!issuePage) {
        throw new Error('Failed to launch issue-642-bug8 page')
      }

      const runtime = await waitForIssue642Bug8Runtime(issuePage)
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

      await expect(readRenderedCase(issuePage, 'direct')).resolves.toEqual({
        exists: true,
        text: '123',
        value: '123',
      })
      await expect(readRenderedCase(issuePage, 'wrapped')).resolves.toEqual({
        exists: true,
        text: '123',
        value: '123',
      })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
