// @ts-expect-error Node 侧编译真实 stateful HMR SFC 后注入虚拟文件。
import sources from 'virtual:stateful-store-binding-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('keeps the Wevu page DOM and Store through template B, restoration and a script patch in one session', async () => {
  const files = createBrowserVirtualFiles(sources as Array<[string, string]>)
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => preview.innerHTML = session.renderCurrentPage().wxml
  const action = (selector: string, eventName: 'tap' | 'input', detail = {}) => {
    render()
    const node = preview.querySelector(selector)!
    expect(node).not.toBeNull()
    const method = node.getAttribute(`data-sim-${eventName}`) ?? node.getAttribute(`bind${eventName}`)
    expect(method).toBeTruthy()
    session.callScopeMethod(node.getAttribute('data-sim-scope')!, method!, {
      type: eventName,
      detail,
      currentTarget: { dataset: { wiTap: node.getAttribute('data-wi-tap'), wvModel: node.getAttribute('data-wv-model') } },
    })
  }
  try {
    const page = session.reLaunch('/pages/wevu/index')
    const app = session.getApp()!
    const check = async (count: number, version: number, templateB: boolean, marker = 'STATEFUL-WEVU-BASE') => {
      await app.flush()
      render()
      expect(preview.querySelector('.count')?.textContent).toBe(String(count))
      expect(preview.querySelector('.store-count')?.textContent).toBe(String(count))
      expect(preview.querySelector('.marker')?.textContent).toBe(marker)
      expect(preview.querySelector('.input')?.getAttribute('value')).toBe('held-input')
      expect(preview.querySelector('.sfc-template')?.textContent).toBe(templateB ? 'SFC-TEMPLATE-B' : undefined)
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
      files.set('pages/wevu/index.wxml', files.get(`fixture/templates/${index}.wxml`)!)
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
    render()
    expect(nextPage).not.toBe(page)
    expect(preview.querySelector('.store-count')?.textContent).toBe('6')
    expect(preview.querySelector('.count')?.textContent).toBe('0')
    expect(preview.querySelector('.input')?.getAttribute('value')).toBe('')
  }
  finally {
    session.close()
    preview.remove()
  }
})
