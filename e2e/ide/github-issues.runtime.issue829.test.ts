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

const ISSUE_ROUTE = '/pages/issue-829/index'

async function readDistText(...segments: string[]) {
  return await fs.readFile(path.join(DIST_ROOT, ...segments), 'utf8')
}

async function readScopedSlotWxml() {
  const pageDir = path.join(DIST_ROOT, 'pages/issue-829')
  const files = (await fs.readdir(pageDir))
    .filter(file => file.startsWith('index.__scoped-slot-default-') && file.endsWith('.wxml'))
  const contents = await Promise.all(files.map(async file => await fs.readFile(path.join(pageDir, file), 'utf8')))
  return contents.join('\n')
}

describe('e2e app: github-issues / issue #829', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('preserves function props for direct and nested scoped-slot components', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      resetAutomatorRuntimeLogs(miniProgram)
      const issuePage = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
        readiness: async (page) => {
          await page.waitForRendered({ selector: '#issue-829-page', timeout: 5_000 })
          return true
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-829 page')
      }

      const renderedOptions = {
        dataset: { queryResolveCount: 2 },
        timeout: 15_000,
      }
      await issuePage.waitForRendered({ ...renderedOptions, selector: '#issue-829-page' })

      const pageNodes = await issuePage.renderedNodes('#issue-829-page', renderedOptions)
      expect(pageNodes).toHaveLength(1)
      const pageNode = pageNodes[0]
      expect(pageNode).toEqual(expect.objectContaining({
        dataset: expect.objectContaining({ queryResolveCount: 2 }),
        height: expect.any(Number),
        width: expect.any(Number),
      }))
      expect(pageNode!.height).toBeGreaterThan(0)
      expect(pageNode!.width).toBeGreaterThan(0)

      const runtimeEntries = miniProgram?.__weappViteRuntimeLogMeta?.entries ?? []
      expect(runtimeEntries.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')).toEqual([])

      const pageWxml = await readDistText('pages/issue-829/index.wxml')
      expect(pageWxml).toContain('query-fn="{{queryFn}}"')
      expect(await readScopedSlotWxml()).toContain('query-fn="{{__wvOwner.queryFn}}"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
