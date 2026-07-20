import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethod,
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

async function readDistWxml(relativePath: string) {
  return await fs.readFile(path.join(DIST_ROOT, relativePath), 'utf8')
}

async function waitForRenderedMarker(page: any, selector: string, dataset: Record<string, string>) {
  await page.waitForRendered({
    selector,
    dataset,
    timeout: 12_000,
  })
}

describe.sequential('e2e app: github-issues / app shell runtime', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #563: renders app.vue shell, page layout, and page content in real DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, '/pages/issue-338/index', undefined, 45_000, {
        readiness: async (page) => {
          await waitForRenderedMarker(page, '#issue338-page', { e2eIssue: '338' })
          return true
        },
      })
      if (!page) {
        throw new Error('Failed to launch issue-338 page')
      }
      await waitForRenderedMarker(page, '#issue338-page', { e2eIssue: '338' })

      const pageWxml = await readDistWxml('pages/issue-338/index.wxml')
      const appShellIndex = pageWxml.indexOf('<weapp-app-shell')
      const layoutIndex = pageWxml.indexOf('<weapp-layout-default')
      const pageContentIndex = pageWxml.indexOf('issue338-page')

      expect(appShellIndex).toBeGreaterThanOrEqual(0)
      expect(layoutIndex).toBeGreaterThan(appShellIndex)
      expect(pageContentIndex).toBeGreaterThan(layoutIndex)

      await expect(readDistWxml('__weapp_vite_app_shell.wxml')).resolves.toContain('issue-563-app-shell')
      await expect(readDistWxml('layouts/default.wxml')).resolves.toContain('issue-380-default-layout')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #448/#563: keeps web runtime URL parsing and app shell when page layout is disabled', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, '/pages/issue-448/index', undefined, 45_000, {
        readiness: async (page) => {
          await waitForRenderedMarker(page, '#issue448-page', { e2eIssue: '448' })
          return true
        },
      })
      if (!page) {
        throw new Error('Failed to launch issue-448 page')
      }
      await waitForRenderedMarker(page, '#issue448-page', { e2eIssue: '448' })

      const pageWxml = await readDistWxml('pages/issue-448/index.wxml')
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const runtime = await callRoutePageMethod(activeMiniProgram, '/pages/issue-448/index', '_runE2E')
      expect(pageWxml).toContain('<weapp-app-shell')
      expect(pageWxml).toContain('issue448-page')
      expect(pageWxml).not.toContain('<weapp-layout-default')
      expect(runtime.parsedUrl).toBe('fake://abc/123')

      await expect(readDistWxml('__weapp_vite_app_shell.wxml')).resolves.toContain('issue-563-app-shell')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
