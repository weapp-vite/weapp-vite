import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

function countToken(wxml: string, token: string) {
  return wxml.split(token).length - 1
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-642/index', 'issue-642 provided default')
      if (!issuePage) {
        throw new Error('Failed to launch issue-642 page')
      }

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime).toMatchObject({
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

      const initialWxml = await readPageWxml(issuePage)
      expect(countToken(initialWxml, 'data-issue642-slot-state="provided-header"')).toBe(1)
      expect(countToken(initialWxml, 'data-issue642-slot-state="provided-default"')).toBe(1)
      expect(countToken(initialWxml, 'data-issue642-slot-state="fallback-header"')).toBe(1)
      expect(countToken(initialWxml, 'data-issue642-slot-state="fallback-default"')).toBe(1)
      expect(countToken(initialWxml, 'data-issue642-slot-state="scoped-provided"')).toBe(1)
      expect(initialWxml).toContain('data-issue642-scoped-value="1234"')

      const action = await issuePage.$('[data-issue642-action="bump"]')
      if (!action) {
        throw new Error('Failed to query issue-642 bump action')
      }
      await action.tap()

      const updatedRuntime = await issuePage.callMethod('_runE2E')
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

      const updatedWxml = await readPageWxml(issuePage)
      expect(countToken(updatedWxml, 'data-issue642-slot-state="provided-header"')).toBe(1)
      expect(countToken(updatedWxml, 'data-issue642-slot-state="provided-default"')).toBe(1)
      expect(countToken(updatedWxml, 'data-issue642-slot-state="fallback-header"')).toBe(1)
      expect(countToken(updatedWxml, 'data-issue642-slot-state="fallback-default"')).toBe(1)
      expect(countToken(updatedWxml, 'data-issue642-slot-state="scoped-provided"')).toBe(1)
      expect(updatedWxml).toContain('data-issue642-scoped-value="1234"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
