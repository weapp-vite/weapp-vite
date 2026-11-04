export const templateCorpusRoutes = ['/pages/adjacent/index', '/pages/bindings/index'] as const

export const templateCorpusBindingStates = [
  { count: 0, label: 'initial', visible: true },
  { count: 1, label: 'updated', visible: true, target: '#binding-probe' },
  { count: 1, label: 'updated', visible: false, target: '#toggle' },
  { count: 2, label: 'updated', visible: false, target: '#update' },
  { count: 2, label: 'updated', visible: true, target: '#toggle' },
]

export function createTemplateCorpusFiles(): Array<[string, string]> {
  return [
    ['app.js', 'App({})\n'],
    ['app.json', `{
  "pages": [
    "pages/adjacent/index",
    "pages/bindings/index"
  ],
  "window": {
    "navigationBarTitleText": "Template corpus"
  }
}
`],
    ['pages/adjacent/index.js', `Page({
  data: { result: 'pending' },
  capture(event) {
    const { first, second, empty } = event.currentTarget.dataset
    this.setData({ result: [first, second, typeof empty, empty].join('|') })
  },
})
`],
    ['pages/adjacent/index.json', '{}\n'],
    ['pages/adjacent/index.wxml', `<view id="corpus-adjacent">
  <view id="adjacent-probe"data-first="one"data-second='two'data-bare data-empty=""bindtap="capture">adjacent</view>
  <text id="adjacent-result">{{result}}</text>
</view>
`],
    ['pages/bindings/index.js', `Page({
  data: { count: 0, label: 'initial', visible: true },
  increment() {
    this.setData({ count: this.data.count + 1, label: 'updated' })
  },
  toggle() {
    this.setData({ visible: !this.data.visible })
  },
})
`],
    ['pages/bindings/index.json', '{}\n'],
    ['pages/bindings/index.wxml', `<view id="corpus-bindings">
  <view wx:if="{{visible}}"class="visible-{{count}}"id="binding-probe"data-value="{{count + 1}}"data-label="{{label}}"bindtap="increment">{{label}}:{{count}}</view>
  <button id="update"bindtap="increment">update</button>
  <button id="toggle"bindtap="toggle">toggle</button>
  <text id="binding-state">{{visible ? 'visible' : 'hidden'}}:{{count}}</text>
</view>
`],
  ]
}
