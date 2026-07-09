import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callCurrentPageMethod,
  closeSharedMiniProgram,
  delay,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

async function readDistWxml(...segments: string[]) {
  return await fs.readFile(path.join(DIST_ROOT, ...segments), 'utf8')
}

async function waitForPageRuntime(miniProgram: any, expected: Record<string, unknown>, timeoutMs = 8_000) {
  const startedAt = Date.now()
  let latest: any

  while (Date.now() - startedAt < timeoutMs) {
    try {
      latest = await callCurrentPageMethod(miniProgram, '_runE2E')
    }
    catch {
      await delay(160)
      continue
    }
    const ready = Object.entries(expected).every(([key, value]) => latest?.[key] === value)
    if (ready) {
      return latest
    }
    await delay(160)
  }

  return latest
}

describe.sequential('e2e app: github-issues / issues #553 and #555', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #553: keeps component v-model arguments separate in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-553/index', undefined, 20_000, {
        readiness: async () => {
          const runtime = await waitForPageRuntime(miniProgram, {
            abc: 'abc-seed',
            modelValue: 'model-seed',
          }, 2_500)
          return runtime?.abc === 'abc-seed' && runtime?.modelValue === 'model-seed'
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-553 page')
      }

      expect(await waitForPageRuntime(miniProgram, {
        abc: 'abc-seed',
        modelValue: 'model-seed',
      })).toMatchObject({
        abc: 'abc-seed',
        modelValue: 'model-seed',
      })

      const pageWxml = await readDistWxml('pages/issue-553/index.wxml')
      const childWxml = await readDistWxml('components/issue-553/ModelArgumentProbe/index.wxml')
      expect(pageWxml).toContain('parent abc = {{abc}}')
      expect(pageWxml).toContain('parent model = {{modelValue}}')
      expect(pageWxml).toContain('data-wd-update-abc="1"')
      expect(pageWxml).toContain('bind:update-modelvalue="__weapp_vite_inline"')
      expect(childWxml).toContain('child abc = {{abcModel}}')
      expect(childWxml).toContain('child model = {{defaultModel}}')

      expect(await callCurrentPageMethod(miniProgram, 'triggerChildAbcE2E')).toBe(true)
      expect(await waitForPageRuntime(miniProgram, {
        abc: 'abc-from-child',
        modelValue: 'model-seed',
      })).toMatchObject({
        abc: 'abc-from-child',
        modelValue: 'model-seed',
      })

      expect(await callCurrentPageMethod(miniProgram, 'triggerChildModelE2E')).toBe(true)
      expect(await waitForPageRuntime(miniProgram, {
        abc: 'abc-from-child',
        modelValue: 'model-from-child',
      })).toMatchObject({
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-555/index', undefined, 20_000, {
        readiness: async () => {
          const runtime = await waitForPageRuntime(miniProgram, {
            value: 'issue-555 conditional slot text',
          }, 2_500)
          return runtime?.value === 'issue-555 conditional slot text'
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-555 page')
      }

      const pageWxml = await readDistWxml('pages/issue-555/index.wxml')
      expect(await waitForPageRuntime(miniProgram, {
        value: 'issue-555 conditional slot text',
      })).toMatchObject({
        value: 'issue-555 conditional slot text',
      })
      expect(pageWxml).toContain('wx:if="{{value}}"')
      expect(pageWxml).toContain('data-probe="conditional-text"')
      expect(pageWxml).toContain('slot="text"')

      await callCurrentPageMethod(miniProgram, 'toggleValue')
      expect(await waitForPageRuntime(miniProgram, {
        value: '',
      })).toMatchObject({
        value: '',
      })

      await callCurrentPageMethod(miniProgram, 'toggleValue')
      expect(await waitForPageRuntime(miniProgram, {
        value: 'issue-555 conditional slot text',
      })).toMatchObject({
        value: 'issue-555 conditional slot text',
      })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
