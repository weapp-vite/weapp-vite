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

const ISSUE_ROUTE = '/pages/issue-868/index'

async function readIssueWxml() {
  return await fs.readFile(path.join(DIST_ROOT, 'pages/issue-868/index.wxml'), 'utf8')
}

async function readAppJson() {
  return JSON.parse(await fs.readFile(path.join(DIST_ROOT, 'app.json'), 'utf8')) as {
    pages?: string[]
  }
}

describe.sequential('e2e app: github-issues / issue #868', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders projected keys and restores source identity in real runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      resetAutomatorRuntimeLogs(miniProgram)
      const issuePage = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
        readiness: async (page) => {
          await page.waitForRendered({ selector: '#issue-868-page', timeout: 5_000 })
          return true
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-868 page')
      }

      const status = await issuePage.$('#issue-868-status', { timeout: 5_000 })
      const cards = await issuePage.$$('.issue868-gallery-card')
      const button = cards[0]
      expect(status).not.toBeNull()
      expect(cards).toHaveLength(2)
      expect(button).toBeTruthy()
      expect((await status?.text())?.replaceAll(/\s/g, '')).toBe('alpha|0')

      await button?.tap()
      await expect.poll(async () => {
        const data = await issuePage.data()
        const currentStatus = await issuePage.$('#issue-868-status', { timeout: 1_000 })
        return {
          count: data.column?.[0]?.item?.count,
          status: (await currentStatus?.text())?.replaceAll(/\s/g, ''),
          title: data.column?.[0]?.item?.title,
        }
      }, { timeout: 10_000 }).toEqual({
        count: 1,
        status: 'alpha-updated|1',
        title: 'alpha-updated',
      })

      const primitiveItems = await issuePage.$$('.issue-868-primitive')
      expect(await Promise.all(primitiveItems.map(item => item.text()))).toEqual([
        'primitive-a',
        'primitive-b',
      ])

      const runtimeEntries = miniProgram?.__weappViteRuntimeLogMeta?.entries ?? []
      expect(runtimeEntries.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')).toEqual([])

      const appJson = await readAppJson()
      expect(appJson.pages).toContain('pages/issue-868/index')

      const wxml = await readIssueWxml()
      expect(wxml).toContain('wx:key="__wv_key_0"')
      expect(wxml).toContain('wx:key="__wv_key_1"')
      expect(wxml).not.toContain('wx:key="*this"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
