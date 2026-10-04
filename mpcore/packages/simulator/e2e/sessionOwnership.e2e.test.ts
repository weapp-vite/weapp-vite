import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('keeps the second rendered project interactive after repeated release of the first', () => {
  function createSession(owner: string) {
    return createBrowserHeadlessSession({
      files: createBrowserVirtualFiles([
        ['app.json', JSON.stringify({ pages: ['pages/home/index', 'pages/detail/index'] })],
        ['app.js', 'App({})'],
        ...['home', 'detail'].flatMap(route => [
          [`pages/${route}/index.json`, '{}'],
          [`pages/${route}/index.js`, `Page({
            data: { label: '${owner}:${route}', count: 0 },
            increment() { this.setData({ count: this.data.count + 1 }) }
          })`],
          [`pages/${route}/index.wxml`, '<view id="label">{{label}}</view><button id="increment" bindtap="increment">Count: {{count}}</button>'],
        ] as Array<[string, string]>),
      ]),
    })
  }

  const first = createSession('first')
  const second = createSession('second')
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = second.renderCurrentPage().wxml
  }
  try {
    first.reLaunch('/pages/home/index')
    second.reLaunch('/pages/home/index')
    render()
    expect(preview.querySelector('#label')?.textContent).toBe('second:home')
    first.close()
    first.close()
    const page = second.reLaunch('/pages/detail/index')
    render()
    expect(preview.querySelector('#label')?.textContent).toBe('second:detail')
    const button = preview.querySelector('#increment')!
    second.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, { type: 'tap' })
    render()
    expect(page.data.count).toBe(1)
    expect(preview.querySelector('#increment')?.textContent).toBe('Count: 1')
    expect(second.getDiagnostics()).toEqual([])
  }
  finally {
    first.close()
    second.close()
    preview.remove()
  }
})
