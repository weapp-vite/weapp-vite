import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectOne } from 'css-select'
import { textContent } from 'domutils'
import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createStatefulStoreBindingFiles } from './helpers/statefulStoreBindings'

describe.each(['node', 'browser'] as const)('%s Wevu page template and script HMR', (provider) => {
  it('retains local and Store bindings through template B, restoration and a script patch in one session', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stateful-store-'))
    const sources = await createStatefulStoreBindingFiles()
    const files = createBrowserVirtualFiles(sources)
    for (const [file, source] of sources) {
      const target = path.join(root, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node' ? createHeadlessSession({ projectPath: root }) : createBrowserHeadlessSession({ files })
    try {
      const page = session.reLaunch('/pages/wevu/index')
      const app = session.getApp()!
      const node = (selector: string) => {
        const element = selectOne(selector, parseDocument(session.renderCurrentPage().wxml).children)
        if (!element || !('attribs' in element)) {
          throw new Error(`Missing rendered Wevu node: ${selector}`)
        }
        return element
      }
      const action = (selector: string, eventName: 'tap' | 'input', detail = {}) => {
        const element = node(selector)
        const method = element.attribs[`data-sim-${eventName}`] ?? element.attribs[`bind${eventName}`]
        expect(method).toBeTruthy()
        session.callScopeMethod(element.attribs['data-sim-scope']!, method!, {
          type: eventName,
          detail,
          currentTarget: { dataset: { wiTap: element.attribs['data-wi-tap'], wvModel: element.attribs['data-wv-model'] } },
        })
      }
      const check = async (count: number, version: number, templateB: boolean, marker = 'STATEFUL-WEVU-BASE') => {
        await app.flush()
        expect(textContent(node('.count'))).toBe(String(count))
        expect(textContent(node('.store-count'))).toBe(String(count))
        expect(textContent(node('.marker'))).toBe(marker)
        expect(node('.input').attribs.value).toBe('held-input')
        expect(session.renderCurrentPage().wxml.includes('SFC-TEMPLATE-B')).toBe(templateB)
        expect(session.getCurrentPages()[0]).toBe(page)
        expect(session.getApp()).toBe(app)
        expect(page.data.identity).toBe('wevu-instance')
        expect(app.version()).toBe(version)
      }
      page.setData({ identity: 'wevu-instance' })
      action('.input', 'input', { value: 'held-input' })
      action('.increment', 'tap')
      action('.increment', 'tap')
      await check(2, 0, false)
      let count = 2
      for (let index = 0; index < 3; index++) {
        const template = files.get(`fixture/templates/${index}.wxml`)!
        if (provider === 'node') {
          fs.writeFileSync(path.join(root, 'pages/wevu/index.wxml'), template)
        }
        else {
          files.set('pages/wevu/index.wxml', template)
        }
        const previousVersion = app.version()
        app.applyEdit(index)
        expect(app.version()).toBe(previousVersion + 1)
        await check(count, index + 1, index === 0, index === 2 ? 'STATEFUL-WEVU-PATCHED' : 'STATEFUL-WEVU-BASE')
        if (index < 2) {
          action('.increment', 'tap')
          await check(++count, index + 1, index === 0)
        }
      }
      action('.increment', 'tap')
      await check(6, 3, false, 'STATEFUL-WEVU-PATCHED')
      expect(app.reports().map((report: { action: string, version: number }) => [report.action, report.version]))
        .toEqual([['register', 0], ['poll', 0], ['poll', 1], ['poll', 2], ['poll', 3]])
      // 后续导航走真实 wx 队列，遵守 HMR 宿主替换事务的结束顺序。
      await app.reLaunch()
      const nextPage = session.getCurrentPages()[0]
      await app.flush()
      expect(nextPage).not.toBe(page)
      expect(textContent(node('.store-count'))).toBe('6')
      expect(textContent(node('.count'))).toBe('0')
      expect(node('.input').attribs.value).toBe('')
    }
    finally {
      session.close()
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
