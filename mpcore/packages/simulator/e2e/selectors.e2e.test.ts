import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { renderedSelectorsFiles } from '../test/helpers/renderedSelectors'

describe('rendered selector parity in the browser', () => {
  it('queries style attributes and structural selectors after a page update', async () => {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles([
      ['app.json', '{"pages":["pages/index/index"]}'],
      ['app.js', 'App({})'],
      ['pages/index/index.js', 'Page({data:{color:"#1f2937",label:"two words"},update(){this.setData({color:"#0f766e",label:"changed words"})}})'],
      ['pages/index/index.wxml', '<view class="list"><text style="color:{{color}}">first</text><text title="{{label}}">{{label}}</text></view>'],
    ]) })
    const preview = document.createElement('div')
    document.body.append(preview)
    const render = () => {
      const tree = session.renderCurrentPage()
      preview.innerHTML = tree.wxml
      return new HeadlessTestingNodeHandle(tree.root)
    }
    try {
      const page = session.reLaunch('/pages/index/index')
      let root = render()
      expect(await (await root.$('[style*="#1f2937"]'))?.text()).toBe('first')
      expect(await (await root.$('.list > text:nth-child(2)[title="two words"]'))?.text()).toBe('two words')
      expect(preview.querySelector('[title="two words"]')?.textContent).toBe('two words')
      page.update()
      root = render()
      expect(await root.$('[style*="#1f2937"]')).toBeNull()
      expect(await (await root.$('[style*="#0f766e"] + text[title="changed words"]'))?.text()).toBe('changed words')
      expect(preview.querySelector('[title="changed words"]')?.textContent).toBe('changed words')
      await expect(root.$('[title=')).rejects.toThrow()
    }
    finally {
      session.close()
      preview.remove()
    }
  })

  it('queries dynamic loop ancestors after actual component button events', async () => {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(renderedSelectorsFiles()) })
    const preview = document.createElement('div')
    document.body.append(preview)
    const render = () => {
      const tree = session.renderCurrentPage()
      preview.innerHTML = tree.wxml
      return new HeadlessTestingNodeHandle(tree.root, {
        callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
        createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
        createScopeHandle: () => null,
        ownerScopeId: () => null,
      })
    }
    try {
      session.reLaunch('/pages/index/index')
      await (await (await render().$('emitter'))!.$('#emit-direct-payload'))!.tap()
      expect(await (await render().$('#emit-record-0 .emit-label'))?.text()).toBe('payload-1')
      expect(preview.querySelector('#emit-record-0 .emit-label')?.textContent).toBe('payload-1')
      await (await (await render().$('emitter'))!.$('#emit-direct-payload'))!.tap()
      const root = render()
      expect(await (await root.$('#emit-record-0 > .emit-label'))?.text()).toBe('payload-2')
      expect(await (await root.$('#emit-record-0 + #emit-record-1 .emit-label'))?.text()).toBe('payload-1')
      expect(preview.querySelector('#emit-record-0 + #emit-record-1 .emit-label')?.textContent).toBe('payload-1')
      await (await (await render().$('emitter'))!.$('#emit-native'))!.tap()
      expect(await (await render().$('#native-result'))?.text()).toBe('tap:undefined:number')
      expect(preview.querySelector('#native-result')?.textContent).toBe('tap:undefined:number')
    }
    finally {
      session.close()
      preview.remove()
    }
  })
})
