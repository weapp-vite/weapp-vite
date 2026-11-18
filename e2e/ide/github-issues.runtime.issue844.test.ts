import type { MiniProgramWithRuntimeLogs } from '../utils/automator'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ROUTES = [
  {
    route: '/pages/issue-844/index',
    outputRoot: 'miniprogram_npm/tdesign-miniprogram',
    text: 'Button',
    pageSelector: '.issue-844-page',
  },
  {
    route: '/subpackages/issue-844-normal/index',
    outputRoot: 'subpackages/issue-844-normal/miniprogram_npm/tdesign-miniprogram',
    text: 'Normal',
    pageSelector: '.issue-844-normal',
  },
  {
    route: '/subpackages/issue-844-independent/index',
    outputRoot: 'subpackages/issue-844-independent/miniprogram_npm/tdesign-miniprogram',
    text: 'Independent',
    pageSelector: '.issue-844-independent',
  },
] as const

describe('e2e app: github-issues / issue #844', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    const appConfig = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as {
      pages?: string[]
      subPackages?: Array<{ root?: string, pages?: string[] }>
    }
    expect(appConfig.pages).toContain('pages/issue-844/index')
    expect(appConfig.subPackages).toEqual(expect.arrayContaining([
      expect.objectContaining({ root: 'subpackages/issue-844-normal' }),
      expect.objectContaining({ root: 'subpackages/issue-844-independent' }),
    ]))
    for (const item of ROUTES) {
      await expect(fs.pathExists(path.join(DIST_ROOT, item.outputRoot, 'button/button.js'))).resolves.toBe(true)
      await expect(fs.pathExists(path.join(DIST_ROOT, item.outputRoot, 'dialog/index.js'))).resolves.toBe(false)
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders the retained npm button in the main, normal and independent packages', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [
      {
        id: '/pages/issue-844/index',
        route: '/pages/issue-844/index',
        action: '检查主包页面中裁剪后仍可渲染 TDesign Button',
        nodes: [
          { selector: '.issue-844-page', count: 1 },
          { selector: 'component', has: '.t-button', text: 'Button' },
        ],
      },
      {
        id: '/subpackages/issue-844-normal/index',
        route: '/subpackages/issue-844-normal/index',
        action: '检查普通分包页面中裁剪后仍可渲染 TDesign Button',
        nodes: [
          { selector: '.issue-844-normal', count: 1 },
          { selector: 'component', has: '.t-button', text: 'Normal' },
        ],
      },
      {
        id: '/subpackages/issue-844-independent/index',
        route: '/subpackages/issue-844-independent/index',
        action: '检查独立分包页面中裁剪后仍可渲染 TDesign Button',
        nodes: [
          { selector: '.issue-844-independent', count: 1 },
          { selector: 'component', has: '.t-button', text: 'Independent' },
        ],
      },
    ])
    const miniProgram: MiniProgramWithRuntimeLogs = await getSharedMiniProgram(ctx)
    try {
      for (const item of ROUTES) {
        const page = await relaunchPage(miniProgram, item.route, item.text, 45_000, {
          readiness: 'wxml',
        })
        if (!page) {
          throw new Error(`Failed to launch ${item.route}`)
        }
        await dom.check(item.route, miniProgram, page)
      }

      const runtimeErrors = miniProgram.__weappViteRuntimeLogMeta?.entries
        ?.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')
        ?? []
      expect(runtimeErrors).toEqual([])
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
