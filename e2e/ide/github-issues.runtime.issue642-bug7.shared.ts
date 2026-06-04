import { expect } from 'vitest'
import {
  getSharedMiniProgram,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

function countToken(wxml: string, token: string) {
  return wxml.split(token).length - 1
}

export async function runIssue642Bug7RuntimeCase(ctx: { skip: (message?: string) => void }) {
  const miniProgram = await getSharedMiniProgram(ctx)
  try {
    const issuePage = await relaunchPage(miniProgram, '/pages/issue-642-bug7/index', '1234')
    if (!issuePage) {
      throw new Error('Failed to launch issue-642-bug7 page')
    }

    const initialRuntime = await issuePage.callMethod('_runE2E')
    expect(initialRuntime).toMatchObject({
      tick: 0,
      owner: {
        dataOwnerId: expect.any(String),
        runtimeOwnerId: expect.any(String),
        dataBind0: {
          default: true,
        },
        dataBind1: {
          default: true,
        },
        runtimeBind0: {
          default: true,
        },
        runtimeBind1: {
          default: true,
        },
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
    expect(initialRuntime.scoped.propsSlotOwnerId).not.toBe('')
    expect(initialRuntime.scoped.dataSlotOwnerId).toBe(initialRuntime.scoped.propsSlotOwnerId)
    expect(initialRuntime.provided.dataVueSlots).toEqual(initialRuntime.provided.propertyVueSlots)

    const initialWxml = await readPageWxml(issuePage)
    expect(countToken(initialWxml, 'data-issue642-bug7-cell1-state="scoped"')).toBe(1)
    expect(initialWxml).toContain('data-issue642-bug7-scoped-value="1"')
    expect(countToken(initialWxml, 'data-issue642-bug7-cell2-state="provided"')).toBe(1)
    expect(initialWxml).not.toContain('data-issue642-bug7-cell2-state="fallback"')

    const action = await issuePage.$('[data-issue642-bug7-action="bump"]')
    if (!action) {
      throw new Error('Failed to query issue-642-bug7 bump action')
    }
    await action.tap()

    const updatedRuntime = await issuePage.callMethod('_runE2E')
    expect(updatedRuntime).toMatchObject({
      tick: 1,
      owner: {
        dataOwnerId: initialRuntime.owner.dataOwnerId,
        runtimeOwnerId: initialRuntime.owner.runtimeOwnerId,
        dataBind0: {
          default: true,
        },
        dataBind1: {
          default: true,
        },
        runtimeBind0: {
          default: true,
        },
        runtimeBind1: {
          default: true,
        },
      },
      scoped: {
        dataSlotOwnerId: initialRuntime.scoped.dataSlotOwnerId,
        propsSlotOwnerId: initialRuntime.scoped.propsSlotOwnerId,
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

    const updatedWxml = await readPageWxml(issuePage)
    expect(countToken(updatedWxml, 'data-issue642-bug7-cell1-state="scoped"')).toBe(1)
    expect(updatedWxml).toContain('data-issue642-bug7-scoped-value="1"')
    expect(countToken(updatedWxml, 'data-issue642-bug7-cell2-state="provided"')).toBe(1)
    expect(updatedWxml).not.toContain('data-issue642-bug7-cell2-state="fallback"')
  }
  finally {
    await releaseSharedMiniProgram(miniProgram)
  }
}
