import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildWxmlTransformProject, createWxmlTransformProject } from '../utils/wxmlTransformProject'

async function attribute(element: { attribute?: (name: string) => Promise<string | undefined>, attr?: (name: string) => Promise<string | undefined> } | null, name: string) {
  return typeof element?.attribute === 'function' ? element.attribute(name) : element?.attr?.(name)
}

let project: string
let miniProgram: MiniProgram | undefined

describe('WXML function transform runtime', { concurrent: false }, () => {
  beforeAll(async () => {
    project = await createWxmlTransformProject()
    await buildWxmlTransformProject(project)
    for (const kind of ['native', 'vue']) {
      for (const ext of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist/pages/${kind}/index.${ext}`))
      }
      const source = await readFile(path.join(project, `dist/pages/${kind}/index.wxml`), 'utf8')
      expect(source).not.toContain('data-clean=')
      expect(source).not.toContain('data-use-view')
      expect(source).toContain('data-analytics=')
      expect(source).toContain('data-testid="keep"')
      expect(source).toContain('bindtap=')
      expect(source).not.toContain('removed-child')
    }
    miniProgram = await launchAutomator({ projectPath: project, warmupRoute: '/pages/native/index', warmupRootSelectors: ['#transform-root'] })
  }, 180_000)

  afterAll(async () => {
    await miniProgram?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)

  for (const kind of ['native', 'vue']) {
    it(`preserves typed attributes, renamed tags and events in ${kind} templates`, async (context) => {
      const host = miniProgram!
      const route = `/pages/${kind}/index`
      const page = await host.reLaunch(route)
      const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/wxml-transform', [
        { id: 'transformed', route, action: '验证标签转换与子内容保留', nodes: [{ selector: 'view#renamed', text: 'renamed' }, { selector: '#retained', text: 'retained' }] },
        { id: 'event', route, action: '验证属性改名后受保护的点击事件', nodes: [{ selector: '#result', text: '1:track' }] },
      ])
      await dom.check('transformed', host, page)
      const renamed = await page.$('view#renamed')
      expect(await attribute(renamed, 'data-literal')).toBe('中文 & "单\'双" \\ {{literal}}')
      expect(await attribute(renamed, 'data-number')).toBe('42')
      expect(await attribute(renamed, 'data-bool')).toBe('false')
      expect(await attribute(renamed, 'data-expression')).toBe('dynamic')
      const retained = await page.$('#retained')
      expect(await attribute(retained, 'data-testid')).toBe('keep')
      expect(await attribute(retained, 'data-direct-child')).toBe('true')
      const nested = await page.$('view#nested-child')
      expect(await nested?.text()).toBe('nested')
      expect(await attribute(nested, 'data-subtree-visited')).toBe('true')
      expect(await page.$('[data-remove-subtree]')).toBeNull()
      const button = await page.$('#tap')
      await button?.tap()
      await dom.check('event', host, page)
    })
  }
})
