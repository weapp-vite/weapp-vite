import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resetAutomatorRuntimeLogs } from '../utils/automator'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_ROUTE = '/pages/issue-852/index'

async function readIssueWxml() {
  return await fs.readFile(path.join(DIST_ROOT, 'pages/issue-852/index.wxml'), 'utf8')
}

async function readAppJson() {
  return JSON.parse(await fs.readFile(path.join(DIST_ROOT, 'app.json'), 'utf8')) as {
    pages?: string[]
    preloadRule?: Record<string, unknown>
  }
}

describe.sequential('e2e app: github-issues / issue #852', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders numeric separator bindings in real WeChat DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      resetAutomatorRuntimeLogs(miniProgram)
      const issuePage = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
        readiness: async (page) => {
          await page.waitForRendered({ selector: '#issue-852', timeout: 5_000 })
          return true
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-852 page')
      }

      await issuePage.waitForRendered({ selector: '#issue-852', timeout: 10_000 })
      await expect.poll(async () => {
        const component = await issuePage.$('#issue-852-count-component', { timeout: 1_000 })
        return await component?.data('value')
      }, { timeout: 10_000 }).toBe(1_000_000)

      const root = await issuePage.$('#issue-852', { timeout: 5_000 })
      const countComponent = await issuePage.$('#issue-852-count-component', { timeout: 5_000 })
      const count = await countComponent?.$('#issue-852-count', { timeout: 5_000 })
      expect(root).not.toBeNull()
      expect(countComponent).not.toBeNull()
      expect(count).not.toBeNull()
      expect(await countComponent?.data('value')).toBe(1_000_000)
      expect(await count?.text()).toBe('Count: 1000000')
      expect(await root?.attribute('data-decimal')).toBe('1000000000000')
      expect(await root?.attribute('data-fraction')).toBe('1050.95')
      expect(await root?.attribute('data-binary')).toBe('41349')
      expect(await root?.attribute('data-octal')).toBe('1198')
      expect(await root?.attribute('data-hex')).toBe('10531008')

      const runtimeEntries = miniProgram?.__weappViteRuntimeLogMeta?.entries ?? []
      expect(runtimeEntries.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')).toEqual([])

      const appJson = await readAppJson()
      expect(appJson.pages).toContain('pages/issue-852/index')
      expect(appJson.preloadRule).toBeUndefined()

      const wxml = await readIssueWxml()
      expect(wxml).toContain('value="{{1000000}}"')
      expect(wxml).not.toMatch(/(?:\d_\d|0[bxo]|\d+n\b)/i)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
