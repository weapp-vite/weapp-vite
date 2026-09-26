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

const ISSUE_ROUTE = '/pages/issue-930/index'
const NESTED_VARS_ROUTE = '/pages/css-nested-vars/index'

describe('e2e app: github-issues / issue #930', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-930/index.js',
      'pages/issue-930/index.json',
      'pages/issue-930/index.wxml',
      'pages/css-nested-vars/index.js',
      'pages/css-nested-vars/index.json',
      'pages/css-nested-vars/index.wxml',
      'pages/css-nested-vars/index.wxss',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
    const config = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as { pages: string[] }
    expect(config.pages).toContain(NESTED_VARS_ROUTE.slice(1))
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('preserves native nested CSS fallbacks through dynamic overrides and restoration', async (ctx) => {
    const provider = resolveRuntimeProviderName()
    const stages = ['initial', 'updated', 'restored'] as const
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', stages.map(stage => ({
      id: `nested-vars:${stage}`,
      route: NESTED_VARS_ROUTE,
      action: stage === 'initial' ? '检查两层行高、三层圆角和渐变 fallback' : stage === 'updated' ? '点击覆盖变量后检查渲染与实际样式' : '再次点击恢复默认 fallback',
      nodes: [
        { selector: '#vars-root', attributes: { class: `vars-root ${stage === 'updated' ? 'override' : 'baseline'}` } },
        { selector: '#vars-state', text: stage === 'updated' ? 'updated' : 'initial' },
        { selector: '#vars-nested', text: 'Nested fallback', ...(provider === 'devtools'
          ? {
              visible: true,
              styles: {
                'line-height': stage === 'updated' ? '40px' : '28px',
                'border-top-left-radius': stage === 'updated' ? '12px' : '8px',
                'border-top-right-radius': stage === 'updated' ? '12px' : '8px',
                'border-bottom-left-radius': stage === 'updated' ? '12px' : '8px',
                'border-bottom-right-radius': stage === 'updated' ? '12px' : '8px',
              },
            }
          : {}) },
        { selector: '#vars-flat', text: 'Flat reference', ...(provider === 'devtools' ? { visible: true, styles: { 'line-height': '28px' } } : {}) },
        { selector: '#vars-gradient', text: 'Gradient fallback', ...(provider === 'devtools' ? { visible: true, styles: { 'background-image': stage === 'updated' ? 'linear-gradient(to right, rgb(239, 68, 68), rgb(59, 130, 246))' : 'linear-gradient(to right, rgb(5, 223, 114), rgb(0, 187, 253))' } } : {}) },
        { selector: '.vars-block', count: 4 },
        { selector: '#vars-toggle', text: 'Toggle' },
      ],
    })))
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, NESTED_VARS_ROUTE, undefined, 45_000, {
        readiness: async (targetPage) => {
          await targetPage.waitForRendered({ selector: '#vars-nested', timeout: 5_000 })
          return true
        },
      })
      if (!page) {
        throw new Error('Failed to launch nested CSS variable page')
      }
      for (const stage of stages) {
        await dom.check(`nested-vars:${stage}`, miniProgram, page)
        if (provider === 'devtools') {
          const [nested] = await page.$$('#vars-nested', { fallback: false })
          const [flat] = await page.$$('#vars-flat', { fallback: false })
          const [gradient] = await page.$$('#vars-gradient', { fallback: false })
          expect(await nested.size()).toEqual({ width: 280, height: stage === 'updated' ? 40 : 28 })
          expect(await flat.size()).toEqual({ width: 280, height: 28 })
          expect(await gradient.size()).toEqual({ width: 280, height: 50 })
        }
        if (stage !== 'restored') {
          const buttons = await page.$$('#vars-toggle', { fallback: false })
          expect(buttons).toHaveLength(1)
          await buttons[0].tap()
        }
      }
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('keeps every compiler-owned binding live on initial and subsequent setData', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', ['initial', 'updated'].map(state => ({
      id: state,
      route: ISSUE_ROUTE,
      action: state === 'initial' ? '检查首屏编译器拥有的绑定' : '更新成员表达式、model、template 和 CSS 变量后检查渲染',
      nodes: [
        { selector: '#issue-930-member', text: `member-${state}` },
        { selector: '#issue-930-template-value', text: `template-${state}` },
        { selector: '#issue-930-model-probe', scope: ['#issue-930-model-component'], text: `model-${state}`, attributes: { 'data-trim': 'true' } },
        { selector: '#issue-930-root', attributes: { 'data-v-issue-probe': `directive-${state}` }, ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { color: state === 'initial' ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)' } } : {}) },
      ],
    })))
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
        const modelComponent = await page.$('#issue-930-model-component', { timeout: 2_000 })
        const model = await modelComponent?.$('#issue-930-model-probe', { timeout: 2_000 })
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
      await dom.check('initial', await getSharedMiniProgram(ctx), page)

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
      await dom.check('updated', await getSharedMiniProgram(ctx), page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
