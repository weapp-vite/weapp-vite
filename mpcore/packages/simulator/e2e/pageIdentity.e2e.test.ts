import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { getPageInstanceId } from '../src/runtime/pageInstance'

it('distinguishes a new same-route page from the previous rendered instance', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles([
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', 'Page({data:{count:0},increment(){this.setData({count:this.data.count+1})}})'],
    ['pages/index/index.wxml', '<button id="counter" bindtap="increment">count:{{count}}</button>'],
  ]) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
    return preview.querySelector('#counter')!
  }
  try {
    const first = session.reLaunch('/pages/index/index')
    const firstId = getPageInstanceId(first)
    const button = render()
    expect(button.textContent).toBe('count:0')
    session.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, {})
    expect(render().textContent).toBe('count:1')
    expect(getPageInstanceId(session.getCurrentPages().at(-1)!)).toBe(firstId)
    const replacement = session.reLaunch('/pages/index/index')
    expect(replacement.route).toBe(first.route)
    expect(getPageInstanceId(replacement)).not.toBe(firstId)
    expect(render().textContent).toBe('count:0')
    expect(getPageInstanceId(session.getCurrentPages().at(-1)!)).toBe(getPageInstanceId(replacement))
  }
  finally {
    session.close()
    preview.remove()
  }
})
