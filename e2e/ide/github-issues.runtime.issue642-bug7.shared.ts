import { expect } from 'vitest'
import {
  delay,
  getSharedMiniProgram,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

async function waitForIssue642Bug7Runtime(page: any, expectedTick: number, timeoutMs = 8_000) {
  const startedAt = Date.now()
  let latest: any

  while (Date.now() - startedAt < timeoutMs) {
    latest = await page.callMethod('_runE2E')

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

  return latest
}

async function readRenderedSlotState(page: any) {
  const scoped = await page.$('[data-issue642-bug7-cell1-state="scoped"]')
  const provided = await page.$('[data-issue642-bug7-cell2-state="provided"]')
  const fallback = await page.$('[data-issue642-bug7-cell2-state="fallback"]')

  return {
    scopedText: scoped ? (await scoped.text()).trim() : '',
    scopedValue: scoped ? await scoped.attribute('data-issue642-bug7-scoped-value') : undefined,
    hasScoped: Boolean(scoped),
    providedText: provided ? (await provided.text()).trim() : '',
    hasProvided: Boolean(provided),
    hasFallback: Boolean(fallback),
  }
}

async function waitForIssue642Bug7RenderedSlots(page: any, timeoutMs = 8_000) {
  const startedAt = Date.now()
  let latest: Awaited<ReturnType<typeof readRenderedSlotState>> | undefined

  while (Date.now() - startedAt < timeoutMs) {
    latest = await readRenderedSlotState(page)
    const scopedReady = latest.hasScoped
      && latest.scopedText === '1'
      && latest.scopedValue === '1'
    const providedReady = latest.hasProvided
      && latest.providedText === '1234'
      && !latest.hasFallback

    if (scopedReady && providedReady) {
      return latest
    }

    await delay(160)
  }

  return latest ?? await readRenderedSlotState(page)
}

export async function runIssue642Bug7RuntimeCase(ctx: { skip: (message?: string) => void }) {
  const miniProgram = await getSharedMiniProgram(ctx)
  try {
    const issuePage = await relaunchPage(miniProgram, '/pages/issue-642-bug7/index', '1234')
    if (!issuePage) {
      throw new Error('Failed to launch issue-642-bug7 page')
    }

    const initialRuntime = await waitForIssue642Bug7Runtime(issuePage, 0)
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

    const initialSlots = await waitForIssue642Bug7RenderedSlots(issuePage)
    expect(initialSlots).toEqual({
      scopedText: '1',
      scopedValue: '1',
      hasScoped: true,
      providedText: '1234',
      hasProvided: true,
      hasFallback: false,
    })

    const action = await issuePage.$('[data-issue642-bug7-action="bump"]')
    if (!action) {
      throw new Error('Failed to query issue-642-bug7 bump action')
    }
    await action.tap()

    const updatedRuntime = await waitForIssue642Bug7Runtime(issuePage, 1)
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

    const updatedSlots = await waitForIssue642Bug7RenderedSlots(issuePage)
    expect(updatedSlots).toEqual({
      scopedText: '1',
      scopedValue: '1',
      hasScoped: true,
      providedText: '1234',
      hasProvided: true,
      hasFallback: false,
    })
  }
  finally {
    await releaseSharedMiniProgram(miniProgram)
  }
}
