import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('matches DevTools reserved host property projection', () => {
  const files = createBrowserVirtualFiles([
    ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['app.js', 'App({})'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { probe: '../../components/probe/index' } })],
    ['pages/index/index.js', 'Page({ inspect() { return this.selectComponent("probe").snapshot() } })'],
    ['pages/index/index.wxml', '<probe id="host-id" class="host-class" slot="host-slot" wx:if="{{true}}" style="color: rgb(22, 119, 255);" />'],
    ['components/probe/index.json', '{}'],
    ['components/probe/index.js', `Component({
      properties: { id: String, class: String, slot: String, 'wx:if': Boolean, style: String },
      methods: { snapshot() { return {
        id: this.properties.id ?? '',
        class: this.properties.class ?? '',
        slot: this.properties.slot ?? '',
        wxIf: this.properties['wx:if'] ?? false,
        style: this.properties.style ?? '',
      } } },
    })`],
    ['components/probe/index.wxml', '<view>{{id}}|{{class}}|{{slot}}|{{style}}</view>'],
  ])
  const session = createBrowserHeadlessSession({ files })
  try {
    const page = session.reLaunch('/pages/index/index')
    session.renderCurrentPage()
    expect(page.inspect()).toEqual({
      id: '',
      class: '',
      slot: '',
      wxIf: false,
      style: 'color: rgb(22, 119, 255);',
    })
  }
  finally {
    session.close()
  }
})
