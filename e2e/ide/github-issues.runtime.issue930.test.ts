import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

const ISSUE_ROUTE = '/pages/issue-930/index'

describe('e2e app: github-issues / issue #930', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-930/index.js',
      'pages/issue-930/index.json',
      'pages/issue-930/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps every compiler-owned binding live on initial and subsequent setData', async (ctx) => {
    const wxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-930/index.wxml'), 'utf8')
    expect(wxml).toContain('data-v-issue-probe="{{directiveState}}"')
    expect(wxml).toMatch(/model-modifiers="\{\{__wv_bind_\d+\}\}"/)
    expect(wxml).toContain('is="{{activeTemplate}}"')
    expect(wxml).toContain('data="{{...templateData}}"')
    expect(wxml).toMatch(/style="\{\{__wv_style_\d+\}\}"/)

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
        readiness: async (targetPage) => {
          await targetPage.waitForRendered({ selector: '#issue-930-root', timeout: 5_000 })
          return true
        },
      })
      if (!page) {
        throw new Error('Failed to launch issue-930 page')
      }

      const readRenderedState = async () => {
        const root = await page.$('#issue-930-root', { timeout: 2_000 })
        const member = await page.$('#issue-930-member', { timeout: 2_000 })
        const model = await page.$('#issue-930-model-probe', { timeout: 2_000 })
        const template = await page.$('#issue-930-template-value', { timeout: 2_000 })
        return {
          cssVars: await readElementAttribute(root, 'style'),
          directive: await readElementAttribute(root, 'data-v-issue-probe'),
          member: (await member?.text())?.trim(),
          model: await readElementAttribute(model, 'data-model-value'),
          template: (await template?.text())?.trim(),
          trim: await readElementAttribute(model, 'data-trim'),
        }
      }

      await expect.poll(readRenderedState, { timeout: 10_000 }).toEqual({
        cssVars: expect.stringContaining('red'),
        directive: 'directive-initial',
        member: 'member-initial',
        model: 'model-initial',
        template: 'template-initial',
        trim: 'true',
      })

      expect(await page.callMethod('_runE2E', 'mutate')).toEqual({
        directiveState: 'directive-updated',
        memberValue: 'member-updated',
        modelValue: 'model-updated',
        templateLabel: 'template-updated',
        themeColor: 'blue',
      })
      await expect.poll(readRenderedState, { timeout: 10_000 }).toEqual({
        cssVars: expect.stringContaining('blue'),
        directive: 'directive-updated',
        member: 'member-updated',
        model: 'model-updated',
        template: 'template-updated',
        trim: 'true',
      })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
