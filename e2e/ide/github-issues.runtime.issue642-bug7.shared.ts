import fs from 'node:fs/promises'
import path from 'pathe'
import { expect } from 'vitest'
import {
  callRoutePageMethod,
  delay,
  DIST_ROOT,
  getSharedMiniProgram,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

async function waitForIssue642Bug7Runtime(miniProgram: any, expectedTick: number, timeoutMs = 30_000) {
  const startedAt = Date.now()
  let latest: any
  let lastError: unknown

  while (Date.now() - startedAt < timeoutMs) {
    try {
      latest = await callRoutePageMethod(miniProgram, '/pages/issue-642-bug7/index', '_runE2E')
    }
    catch (error) {
      lastError = error
      await delay(160)
      continue
    }

    const ownerReady = typeof latest?.owner?.dataOwnerId === 'string'
      && latest.owner.dataOwnerId.length > 0
      && latest.owner.runtimeOwnerId === latest.owner.dataOwnerId
    const providedReady = latest?.provided?.dataVueSlots?.default === true
      && latest?.provided?.propertyVueSlots?.default === true
      && latest?.provided?.hasDefault === true
    const scopedReady = latest?.scoped?.dataSlotOwnerId === latest?.owner?.dataOwnerId
      && latest?.scoped?.propsSlotOwnerId === latest?.owner?.dataOwnerId

    if (latest?.tick === expectedTick && ownerReady && providedReady && scopedReady) {
      return latest
    }

    await delay(160)
  }

  if (latest == null && lastError) {
    throw lastError
  }
  return latest
}

async function readIssue642Bug7WxmlBundle() {
  const pageDistRoot = path.join(DIST_ROOT, 'pages/issue-642-bug7')
  const pageEntries = await fs.readdir(pageDistRoot)
  const pageWxmlFiles = pageEntries.filter(file => file.endsWith('.wxml')).sort()
  const files = [
    ...pageWxmlFiles.map(file => path.join(pageDistRoot, file)),
    path.join(DIST_ROOT, 'components/issue-642-bug7/Cell2/index.wxml'),
  ]
  const contents = await Promise.all(files.map(async file => await fs.readFile(file, 'utf8')))
  return contents.join('\n')
}

export async function runIssue642Bug7RuntimeCase(ctx: { skip: (message?: string) => void }) {
  const miniProgram = await getSharedMiniProgram(ctx)
  try {
    const issuePage = await relaunchPage(miniProgram, '/pages/issue-642-bug7/index', undefined, 45_000, {
      readiness: async (page) => {
        await page.waitForRendered({
          selector: '#issue642-bug7-page',
          dataset: { e2eIssue: '642-bug7' },
          timeout: 4_000,
        })
        return true
      },
    })
    if (!issuePage) {
      throw new Error('Failed to launch issue-642-bug7 page')
    }
    const activeMiniProgram = await getSharedMiniProgram(ctx)

    const renderedWxml = await readIssue642Bug7WxmlBundle()
    expect(renderedWxml).toContain('data-issue642-bug7-cell1-state="scoped"')
    expect(renderedWxml).toContain('data-issue642-bug7-scoped-value="{{__wvSlotPropsData.io}}"')
    expect(renderedWxml).toContain('data-issue642-bug7-cell2-state="provided">1234</text>')
    expect(renderedWxml).toContain('data-issue642-bug7-cell2-state="fallback">5678</text>')

    const initialRuntime = await waitForIssue642Bug7Runtime(activeMiniProgram, 0)
    expect(initialRuntime).toMatchObject({
      tick: 0,
      owner: {
        dataOwnerId: expect.any(String),
        runtimeOwnerId: expect.any(String),
      },
      scoped: {
        propsSlotOwnerId: expect.any(String),
        dataSlotOwnerId: expect.any(String),
      },
      provided: {
        dataVueSlots: {
          default: true,
        },
        propertyVueSlots: {
          default: true,
        },
        hasDefault: true,
      },
    })
    expect(initialRuntime.owner.dataOwnerId).not.toBe('')
    expect(initialRuntime.owner.runtimeOwnerId).toBe(initialRuntime.owner.dataOwnerId)
    expect(initialRuntime.scoped.dataSlotOwnerId).toBe(initialRuntime.owner.dataOwnerId)
    expect(initialRuntime.scoped.propsSlotOwnerId).toBe(initialRuntime.owner.dataOwnerId)
    expect(initialRuntime.provided.dataVueSlots).toEqual(initialRuntime.provided.propertyVueSlots)

    await callRoutePageMethod(activeMiniProgram, '/pages/issue-642-bug7/index', '_runE2E', 'bump')

    const updatedRuntime = await waitForIssue642Bug7Runtime(activeMiniProgram, 1)
    expect(updatedRuntime).toMatchObject({
      tick: 1,
      owner: {
        dataOwnerId: initialRuntime.owner.dataOwnerId,
        runtimeOwnerId: initialRuntime.owner.runtimeOwnerId,
      },
      provided: {
        dataVueSlots: {
          default: true,
        },
        propertyVueSlots: {
          default: true,
        },
        hasDefault: true,
      },
    })
    expect(updatedRuntime.provided.dataVueSlots).toEqual(updatedRuntime.provided.propertyVueSlots)
    expect(updatedRuntime.scoped.dataSlotOwnerId).toBe(initialRuntime.owner.dataOwnerId)
    expect(updatedRuntime.scoped.propsSlotOwnerId).toBe(initialRuntime.owner.dataOwnerId)
  }
  finally {
    await releaseSharedMiniProgram(miniProgram)
  }
}
