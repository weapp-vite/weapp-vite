import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

interface RuntimeElementAttributeReader {
  attr?: (name: string) => Promise<string | undefined>
  attribute?: (name: string) => Promise<string | undefined>
}

async function readElementAttribute(element: RuntimeElementAttributeReader | undefined, name: string) {
  if (typeof element?.attribute === 'function') {
    return await element.attribute(name)
  }
  if (typeof element?.attr === 'function') {
    return await element.attr(name)
  }
  return undefined
}

function collectCssVarNames(style: string) {
  return [...style.matchAll(/var\(--([^)]+)\)/g)].map(match => match[1]!)
}

const ISSUE_ROUTE = '/pages/issue-1015/index'

describe('e2e app: github-issues / issue #1015', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      await expect(fs.pathExists(path.join(DIST_ROOT, `pages/issue-1015/index.${extension}`))).resolves.toBe(true)
    }

    const pageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-1015/index.js'), 'utf8')
    const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-1015/index.wxml'), 'utf8')
    const pageWxss = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-1015/index.wxss'), 'utf8')
    const cssVarNames = collectCssVarNames(pageWxss)
    expect(cssVarNames.length).toBeGreaterThan(0)
    for (const cssVarName of cssVarNames) {
      expect(pageJs).toContain(`"${cssVarName}"`)
    }
    expect(pageWxml).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('updates rendered styles backed by CSS v-bind from an external style block', async (ctx) => {
    const provider = resolveRuntimeProviderName()
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [
      {
        id: 'initial',
        route: ISSUE_ROUTE,
        action: '检查外部 CSS 变量的首屏注入',
        nodes: [
          {
            selector: '#issue-1015-page',
            attributes: { 'data-theme-color': 'red' },
            ...(provider === 'devtools' ? { styles: { color: 'rgb(255, 0, 0)' } } : {}),
          },
          { selector: '#issue-1015-state', text: 'external css vars initial' },
        ],
      },
      {
        id: 'updated',
        route: ISSUE_ROUTE,
        action: '更新响应式颜色后检查外部 CSS 变量样式',
        nodes: [
          {
            selector: '#issue-1015-page',
            attributes: { 'data-theme-color': 'blue' },
            ...(provider === 'devtools' ? { styles: { color: 'rgb(0, 0, 255)' } } : {}),
          },
          { selector: '#issue-1015-state', text: 'external css vars updated' },
        ],
      },
    ])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
        readiness: async (targetPage) => {
          await targetPage.waitForRendered({ selector: '#issue-1015-page', timeout: 5_000 })
          return true
        },
      })
      if (!page) {
        throw new Error('Failed to launch issue-1015 page')
      }

      const readRootStyle = async () => {
        const root = await page.$('#issue-1015-page', { timeout: 2_000 })
        return await readElementAttribute(root, 'style')
      }
      await expect.poll(readRootStyle, { timeout: 10_000 }).toContain('red')
      await dom.check('initial', miniProgram, page)

      expect(await page.callMethod('_runE2E', 'mutate')).toEqual({
        accentColor: 'purple',
        state: 'updated',
        themeColor: 'blue',
      })
      await expect.poll(readRootStyle, { timeout: 10_000 }).toContain('blue')
      await dom.check('updated', miniProgram, page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
