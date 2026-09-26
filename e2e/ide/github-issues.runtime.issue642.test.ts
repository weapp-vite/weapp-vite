import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
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
import { ISSUE642 } from './githubIssuesDom/scopedSlots'

const ISSUE_642_ROUTE = '/pages/issue-642/index'

async function waitForIssue642PageMethod(_page: any, miniProgram: any) {
  return Boolean(await miniProgram.evaluate(() => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const page = pages[pages.length - 1] as any
    return page?.route === 'pages/issue-642/index'
      && typeof page?._runE2E === 'function'
  }).catch(() => false))
}

function countToken(wxml: string, token: string) {
  return wxml.split(token).length - 1
}

async function readIssue642WxmlBundle() {
  const pageDistRoot = path.join(DIST_ROOT, 'pages/issue-642')
  const pageEntries = await fs.readdir(pageDistRoot)
  const pageWxmlFiles = pageEntries.filter(file => file.endsWith('.wxml')).sort()
  const files = [
    ...pageWxmlFiles.map(file => path.join(pageDistRoot, file)),
    path.join(DIST_ROOT, 'components/issue-642/SlotProbe/index.wxml'),
  ]
  const contents = await Promise.all(files.map(async file => await fs.readFile(file, 'utf8')))
  return contents.join('\n')
}

async function waitForIssue642Runtime(ctx: { skip: (message?: string) => void }, expectedBase: number, timeoutMs = 30_000) {
  const startedAt = Date.now()
  let latest: any
  const miniProgram = await getSharedMiniProgram(ctx)

  while (Date.now() - startedAt < timeoutMs) {
    try {
      // 页面已由用例启动；持续重新 reLaunch 会打断 DevTools 异步 setData，
      // 使 scoped slot owner marker 在真实渲染完成前被反复清空。
      latest = await callRoutePageMethodWithOptions(miniProgram, ISSUE_642_ROUTE, '_runE2E', {
        protocolTimeoutMs: 12_000,
        readiness: 'route',
        recoveryAttempts: 3,
        retries: 10,
      })
    }
    catch {
      await delay(160)
      continue
    }
    const providedReady = latest?.provided?.dataVueSlots?.default === true
      && latest?.provided?.dataVueSlots?.header === true
      && latest?.provided?.propertyVueSlots?.default === true
      && latest?.provided?.propertyVueSlots?.header === true
      && latest?.provided?.hasDefault === true
      && latest?.provided?.hasHeader === true
    const scopedReady = typeof latest?.scoped?.propsSlotOwnerId === 'string'
      && latest.scoped.propsSlotOwnerId.length > 0
      && latest.scoped.dataSlotOwnerId === latest.scoped.propsSlotOwnerId

    if (latest?.base === expectedBase && providedReady && scopedReady) {
      return latest
    }

    await delay(160)
  }

  return latest
}

describe('e2e app: github-issues / issue #642', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps vueSlots populated after many dynamic object props on the same component', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', ISSUE642)
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_642_ROUTE, undefined, 45_000, {
        readiness: waitForIssue642PageMethod,
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-642 page')
      }

      const initialRuntime = await waitForIssue642Runtime(ctx, 1)
      expect(initialRuntime).toMatchObject({
        base: 1,
        provided: {
          dataVueSlots: {
            default: true,
            header: true,
          },
          propertyVueSlots: {
            default: true,
            header: true,
          },
          hasDefault: true,
          hasHeader: true,
        },
        empty: {
          hasDefault: false,
          hasHeader: false,
        },
        scoped: {
          propsSlotOwnerId: expect.any(String),
          dataSlotOwnerId: expect.any(String),
        },
      })
      expect(initialRuntime.provided.dataVueSlots).toEqual(initialRuntime.provided.propertyVueSlots)
      expect(initialRuntime.scoped.propsSlotOwnerId).not.toBe('')
      expect(initialRuntime.scoped.dataSlotOwnerId).toBe(initialRuntime.scoped.propsSlotOwnerId)

      const initialWxml = await readIssue642WxmlBundle()
      expect(countToken(initialWxml, 'data-issue642-slot-state="provided-header"')).toBe(1)
      expect(countToken(initialWxml, 'data-issue642-slot-state="provided-default"')).toBe(1)
      expect(countToken(initialWxml, 'data-issue642-slot-state="fallback-header"')).toBe(1)
      expect(countToken(initialWxml, 'data-issue642-slot-state="fallback-default"')).toBe(1)
      expect(countToken(initialWxml, 'data-issue642-slot-state="scoped-provided"')).toBe(1)
      expect(initialWxml).toContain('data-issue642-scoped-value="{{__wvSlotPropsData.io}}"')
      await dom.check('initial', await getSharedMiniProgram(ctx), issuePage)

      const controls = await issuePage.$$('.issue642-action', { fallback: false, timeout: 5_000 })
      expect(controls).toHaveLength(1)
      await controls[0].tap()

      const updatedRuntime = await waitForIssue642Runtime(ctx, 2)
      expect(updatedRuntime).toMatchObject({
        base: 2,
        provided: {
          dataVueSlots: {
            default: true,
            header: true,
          },
          propertyVueSlots: {
            default: true,
            header: true,
          },
          hasDefault: true,
          hasHeader: true,
        },
        scoped: {
          dataSlotOwnerId: initialRuntime.scoped.dataSlotOwnerId,
          propsSlotOwnerId: initialRuntime.scoped.propsSlotOwnerId,
        },
      })
      expect(updatedRuntime.provided.dataVueSlots).toEqual(updatedRuntime.provided.propertyVueSlots)
      await dom.check('updated', await getSharedMiniProgram(ctx), issuePage)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
