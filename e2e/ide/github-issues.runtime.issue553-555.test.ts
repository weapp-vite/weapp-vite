import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / issues #553 and #555', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, 60_000)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #553: keeps component v-model arguments separate in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-553/index', 'issue-553 v-model argument')
      if (!issuePage) {
        throw new Error('Failed to launch issue-553 page')
      }

      expect(await issuePage.callMethod('_runE2E')).toMatchObject({
        abc: 'abc-seed',
        modelValue: 'model-seed',
      })

      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('parent abc = abc-seed')
      expect(initialWxml).toContain('parent model = model-seed')
      expect(initialWxml).toContain('child abc = abc-seed')
      expect(initialWxml).toContain('child model = model-seed')

      expect(await issuePage.callMethod('triggerChildAbcE2E')).toBe(true)
      await issuePage.waitFor(260)
      expect(await issuePage.callMethod('_runE2E')).toMatchObject({
        abc: 'abc-from-child',
        modelValue: 'model-seed',
      })

      const abcWxml = await readPageWxml(issuePage)
      expect(abcWxml).toContain('parent abc = abc-from-child')
      expect(abcWxml).toContain('parent model = model-seed')

      expect(await issuePage.callMethod('triggerChildModelE2E')).toBe(true)
      await issuePage.waitFor(260)
      expect(await issuePage.callMethod('_runE2E')).toMatchObject({
        abc: 'abc-from-child',
        modelValue: 'model-from-child',
      })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #555: renders and toggles v-if named slot content in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-555/index', 'issue-555 slot v-if projection')
      if (!issuePage) {
        throw new Error('Failed to launch issue-555 page')
      }

      const initialWxml = await readPageWxml(issuePage)
      expect(await issuePage.callMethod('_runE2E')).toMatchObject({
        value: 'issue-555 conditional slot text',
      })
      expect(initialWxml).toContain('data-probe="conditional-text"')
      expect(await issuePage.$('.issue555-text-probe')).toBeTruthy()

      await issuePage.callMethod('toggleValue')
      await issuePage.waitFor(260)
      const hiddenWxml = await readPageWxml(issuePage)
      expect(await issuePage.callMethod('_runE2E')).toMatchObject({
        value: '',
      })
      expect(hiddenWxml).not.toContain('data-probe="conditional-text"')
      expect(await issuePage.$('.issue555-text-probe')).toBeFalsy()

      await issuePage.callMethod('toggleValue')
      await issuePage.waitFor(260)
      const restoredWxml = await readPageWxml(issuePage)
      expect(await issuePage.callMethod('_runE2E')).toMatchObject({
        value: 'issue-555 conditional slot text',
      })
      expect(restoredWxml).toContain('data-probe="conditional-text"')
      expect(await issuePage.$('.issue555-text-probe')).toBeTruthy()
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
