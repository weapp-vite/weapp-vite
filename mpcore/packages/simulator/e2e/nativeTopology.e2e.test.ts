// @ts-expect-error 此模块由 browser E2E 配置读取共享 issue fixture 后提供。
import sources from 'virtual:native-topology-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders native imported style updates and restored component and route topology', () => {
  const initial = new Map(sources as Array<[string, string]>)
  const host = document.createElement('div')
  document.body.append(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  const content = document.createElement('div')
  shadow.append(style, content)
  try {
    for (const enabled of [false, true, false]) {
      const files = createBrowserVirtualFiles(initial)
      if (enabled) {
        files.set('app.json', '{"pages":["pages/plain/index","pages/imported/index","pages/optional/index"]}')
        files.set('pages/plain/index.json', '{"usingComponents":{"optional-card":"/components/optional/index"}}')
        files.set('pages/plain/index.wxml', `${initial.get('pages/plain/index.wxml')}<optional-card id="optional-component" />`)
      }
      const session = createBrowserHeadlessSession({ files })
      const render = (route: string) => {
        session.reLaunch(route)
        const rendered = session.renderCurrentPage()
        style.textContent = rendered.styles.cssText
        content.innerHTML = rendered.wxml
      }
      try {
        render('/pages/plain/index')
        expect(content.querySelector('.plain')?.textContent).toBe('baseline')
        expect(content.querySelector('#optional-component')?.textContent?.trim() ?? null).toBe(enabled ? 'optional-component' : null)
        for (const [color, computed] of [['#123', 'rgb(17, 34, 51)'], ['#456', 'rgb(68, 85, 102)'], ['#123', 'rgb(17, 34, 51)']]) {
          files.set('styles/theme.wxss', initial.get('styles/theme.wxss')!.replace('#123', color!))
          render('/pages/imported/index')
          expect(content.querySelector('.imported')?.textContent).toBe('baseline')
          expect(getComputedStyle(content.querySelector('.imported')!).color).toBe(computed)
        }
        if (enabled) {
          render('/pages/optional/index')
          expect(content.querySelector('.optional')?.textContent).toBe('baseline')
        }
      }
      finally {
        session.close()
      }
    }
  }
  finally {
    host.remove()
  }
})
