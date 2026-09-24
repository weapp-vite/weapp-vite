import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'

it('renders WXML literal delimiters and escaped attributes without breaking event datasets', async () => {
  const literal = '中文 & "单\'双" \\ {{literal}}'
  const files = createBrowserVirtualFiles(new Map([
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.json', '{}'],
    ['pages/index/index.js', 'Page({data:{result:""},tap(e){this.setData({result:e.currentTarget.dataset.literal})}})'],
    ['pages/index/index.wxml', String.raw`<view id="subtree"><view id="nested-child" data-subtree-visited="{{true}}">nested</view><view id="probe" data-literal="中文 & \"单'双\" \\ {{'{'}}{{'{'}}literal}}" bindtap="tap">probe</view></view><text id="result">{{result}}</text>`],
  ]))
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    const output = session.renderCurrentPage()
    preview.innerHTML = output.wxml
    return new HeadlessTestingNodeHandle(output.root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
  }
  try {
    session.reLaunch('/pages/index/index')
    const probe = await render().$('#probe')
    const nested = preview.querySelector('#subtree > #nested-child')
    expect(nested?.tagName.toLowerCase()).toBe('view')
    expect(nested?.textContent).toBe('nested')
    expect(nested?.getAttribute('data-subtree-visited')).toBe('true')
    expect(preview.querySelector('#probe')?.getAttribute('data-literal')).toBe(literal)
    await probe?.tap()
    render()
    expect(preview.querySelector('#result')?.textContent).toBe(literal)
  }
  finally {
    session.close()
    preview.remove()
  }
})
