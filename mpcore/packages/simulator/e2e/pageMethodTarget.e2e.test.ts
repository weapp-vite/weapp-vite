import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { resolveTestingPageMethodTarget } from '../src/testing/pageMethodTarget'

it('keeps retained-page method completion separate from the current rendered page', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles([
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', `Page({
      data:{owner:'',calls:0},
      onLoad(query){
        this.setData({owner:query.owner})
        this.pending=new Promise(resolve=>{this.finish=resolve})
      },
      identify(){this.setData({calls:this.data.calls+1});return this.data.owner},
      waitForNavigation(){return this.pending},
      completeNavigation(){this.finish(this.data.owner)}
    })`],
    ['pages/index/index.wxml', '<view id="owner">{{owner}}</view><view id="calls">{{calls}}</view>'],
  ]) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => preview.innerHTML = session.renderCurrentPage().wxml
  try {
    const original = session.reLaunch('/pages/index/index?owner=original')
    const top = session.navigateTo('/pages/index/index?owner=top')
    render()
    expect(preview.querySelector('#owner')?.textContent).toBe('top')
    expect(() => resolveTestingPageMethodTarget(original, session.getCurrentPages(), { fallback: false })).toThrow('page is not on top')
    const retained = resolveTestingPageMethodTarget(original, session.getCurrentPages(), { routeOnly: true, fallback: false })!
    expect(retained).toBe(original)
    let settled = false
    const waiting = retained.waitForNavigation().then((value: string) => {
      settled = true
      return value
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    retained.identify()
    retained.completeNavigation()
    await expect(waiting).resolves.toBe('original')
    render()
    expect(preview.querySelector('#owner')?.textContent).toBe('top')
    expect(preview.querySelector('#calls')?.textContent).toBe('0')
    expect(session.getCurrentPages().at(-1)).toBe(top)
    session.navigateBack()
    render()
    expect(preview.querySelector('#owner')?.textContent).toBe('original')
    expect(preview.querySelector('#calls')?.textContent).toBe('1')
    session.reLaunch('/pages/index/index?owner=replacement')
    expect(resolveTestingPageMethodTarget(original, session.getCurrentPages(), { routeOnly: true })).toBeUndefined()
    render()
    expect(preview.querySelector('#owner')?.textContent).toBe('replacement')
    expect(preview.querySelector('#calls')?.textContent).toBe('0')
  }
  finally {
    session.close()
    preview.remove()
  }
})
