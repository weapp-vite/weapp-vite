// @ts-expect-error 此模块由 browser E2E 配置在 Node 侧读取真实 fixture 和 HMR runtime 后提供。
import sources from 'virtual:stateful-vue-component-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('keeps parent and Vue child DOM state through the real bridge patch and restoration', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => preview.innerHTML = session.renderCurrentPage().wxml
  const action = (selector: string, event = {}) => {
    render()
    const node = preview.querySelector(selector)!
    expect(node).not.toBeNull()
    const method = node.getAttribute('data-sim-tap') ?? node.getAttribute('bindinput')
    expect(method).toBeTruthy()
    session.callScopeMethod(node.getAttribute('data-sim-scope')!, method!, { type: 'tap', currentTarget: { dataset: { wiTap: node.getAttribute('data-wi-tap') } }, ...event })
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    const child = page.selectComponent!('#vue-counter')
    const check = async (parent: string, counter: string, result: string, input = 'held-input') => {
      await page.flush()
      render()
      expect(preview.querySelector('.parent-count')?.textContent).toBe(parent)
      expect(preview.querySelector('.child-count')?.textContent).toBe(counter)
      expect(preview.querySelector('.child-result')?.textContent).toBe(result)
      expect(preview.querySelector('.input')?.getAttribute('value')).toBe(input)
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(page.selectComponent!('#vue-counter')).toBe(child)
    }
    await check('0', '0', 'ready', '')
    action('.input', { detail: { value: 'held-input' } })
    action('.parent-increment')
    action('.child-increment')
    await check('1', '1', 'step:1')
    action('.patch')
    await check('1', '1', 'step:1')
    action('.child-increment')
    await check('1', '3', 'step:2')
    action('.restore')
    await check('1', '3', 'step:2')
    action('.child-increment')
    action('.parent-increment')
    await check('2', '4', 'step:1')
  }
  finally {
    session.close()
    preview.remove()
  }
})
