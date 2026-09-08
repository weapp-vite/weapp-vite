import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
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

const CSS_PRE_ENV = 'WEAPP_GITHUB_ISSUE_779_CSS_PRE'

describe('e2e app: github-issues / issue #779', { concurrent: false }, () => {
  let previousCssPre: string | undefined

  beforeAll(async () => {
    // 预处理构建输出到 dist-issue-779，须与默认聚合构建隔离；本 suite 仍只共享一次启动。
    previousCssPre = process.env[CSS_PRE_ENV]
    process.env[CSS_PRE_ENV] = 'true'
    await prepareGithubIssuesBuild()
    await Promise.all(['js', 'json', 'wxml', 'wxss'].map(async (extension) => {
      const source = await fs.readFile(path.join(DIST_ROOT, `pages/issue-779/index.${extension}`), 'utf8')
      expect(source.trim(), `issue-779/index.${extension}`).not.toBe('')
    }))
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    try {
      await closeSharedMiniProgram()
    }
    finally {
      if (previousCssPre === undefined) {
        delete process.env[CSS_PRE_ENV]
      }
      else {
        process.env[CSS_PRE_ENV] = previousCssPre
      }
    }
  })

  it('renders the pre-transformed external SFC stylesheet instead of the original disk source', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'pre-transformed-style',
      route: '/pages/issue-779/index',
      action: '检查 SFC 外链样式经过 pre 插件和 Tailwind 编译后的实际文本与计算颜色',
      nodes: [{
        selector: '#issue779-page',
        count: 1,
        text: 'issue 779',
        styles: { 'color': 'rgb(1, 2, 3)', 'padding-top': '13px' },
      }],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, '/pages/issue-779/index', 'issue 779', 30_000, {
        readiness: 'wxml',
      })
      if (!page) {
        throw new Error('Failed to launch issue-779 page')
      }
      await dom.check('pre-transformed-style', miniProgram, page)
      const runtimeErrors = miniProgram?.__weappViteRuntimeLogMeta?.entries
        ?.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')
        ?? []
      expect(runtimeErrors).toEqual([])
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
