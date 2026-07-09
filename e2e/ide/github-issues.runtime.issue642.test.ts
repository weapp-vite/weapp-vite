import fs from 'node:fs/promises'
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

const ISSUE_642_ROUTE = '/pages/issue-642/index'

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

async function callIssue642Runtime(ctx: { skip: (message?: string) => void }, ...args: any[]) {
  let lastValue: any
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, ISSUE_642_ROUTE, undefined, 45_000, {
      readiness: 'route',
    })
    if (!page) {
      throw new Error('Failed to launch issue-642 page')
    }

    lastValue = await callRoutePageMethodWithOptions(miniProgram, ISSUE_642_ROUTE, '_runE2E', {
      protocolTimeoutMs: 12_000,
      readiness: 'route',
      recoveryAttempts: 3,
      retries: 10,
    }, ...args)
    if (lastValue !== undefined) {
      return lastValue
    }

    process.stdout.write(`[github-issues:issue642-runtime] undefined result attempt=${attempt}/3; restarting shared automator\n`)
    await closeSharedMiniProgram().catch(() => {})
    await delay(800)
  }

  throw new Error(`issue-642 runtime returned undefined after recovery attempts: ${String(lastValue)}`)
}

async function waitForIssue642Runtime(ctx: { skip: (message?: string) => void }, expectedBase: number, timeoutMs = 30_000) {
  const startedAt = Date.now()
  let latest: any

  while (Date.now() - startedAt < timeoutMs) {
    try {
      latest = await callIssue642Runtime(ctx)
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

describe.sequential('e2e app: github-issues / issue #642', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps vueSlots populated after many dynamic object props on the same component', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_642_ROUTE, undefined, 45_000, {
        readiness: 'route',
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

      await callIssue642Runtime(ctx, 'bump')

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
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
