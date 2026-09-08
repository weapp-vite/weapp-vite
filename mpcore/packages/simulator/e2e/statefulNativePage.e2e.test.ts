// @ts-expect-error 此模块由 browser E2E 配置在 Node 侧编译真实 Page fixture 后提供。
import sources from 'virtual:stateful-native-page-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders independent WXSS updates and real Page bridge patches without resetting DOM state', () => {
  const files = createBrowserVirtualFiles(sources as Array<[string, string]>)
  const session = createBrowserHeadlessSession({ files })
  const host = document.createElement('div')
  document.body.append(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  const preview = document.createElement('div')
  shadow.append(style, preview)
  const render = () => {
    const result = session.renderCurrentPage()
    style.textContent = result.styles.cssText
    preview.innerHTML = result.wxml
  }
  const action = (selector: string, event = {}) => {
    render()
    const node = preview.querySelector(selector)!
    expect(node).not.toBeNull()
    const method = node.getAttribute('data-sim-tap') ?? node.getAttribute('bindinput')
    expect(method).toBeTruthy()
    session.callScopeMethod(node.getAttribute('data-sim-scope')!, method!, event)
  }
  try {
    const page = session.reLaunch('/pages/native/index?source=e2e')
    const app = session.getApp()
    const check = (count: number, color: string, input = 'held-input') => {
      render()
      expect(preview.querySelector('.count')?.textContent).toBe(String(count))
      expect(preview.querySelector('.input')?.getAttribute('value')).toBe(input)
      expect(getComputedStyle(preview.querySelector('.page')!).backgroundColor).toBe(color)
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
    }
    const white = 'rgb(255, 255, 255)'
    const blue = 'rgb(219, 234, 254)'
    const styleFile = 'pages/native/index.wxss'
    const originalStyle = files.get(styleFile)!
    check(0, white, '')
    action('.input', { detail: { value: 'held-input' } })
    action('.increment')
    check(1, white)
    files.set(styleFile, originalStyle.replace('#fff', '#dbeafe'))
    check(1, blue)
    page.patchPage()
    check(1, blue)
    action('.increment')
    check(3, blue)
    page.restorePage()
    files.set(styleFile, originalStyle)
    check(3, white)
    action('.increment')
    check(4, white)
  }
  finally {
    session.close()
    host.remove()
  }
})
