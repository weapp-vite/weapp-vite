export const componentPageLifecycleTrace = [
  'child:created',
  'page:created',
  'page:attached',
  'child:attached:page-provide-value',
  'page:onLoad',
  'page:onShow',
  'child:ready',
  'page:ready',
]

export function createComponentPageLifecycleFiles(queryDuringAttachment = false): Array<[string, string]> {
  return [
    ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/empty/index'] })],
    ['app.js', 'App({ trace: [] })'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { 'context-child': '/components/child' } })],
    ['pages/index/index.js', `Component({
    data: { trace: '' },
    lifetimes: {
      created() { getApp().trace.push('page:created') },
      attached() {
        ${queryDuringAttachment ? 'this.selectComponent(\'#child\')' : ''}
        this.providedValue = 'page-provide-value'
        getApp().trace.push('page:attached')
      },
      ready() { getApp().trace.push('page:ready') },
    },
    methods: {
      onLoad() { getApp().trace.push('page:onLoad') },
      onShow() { getApp().trace.push('page:onShow') },
      snapshot() {
        this.setData({ trace: getApp().trace.join('|') })
        return getApp().trace.slice()
      },
    },
  })`],
    ['pages/index/index.wxml', '<view><context-child id="child" /><text id="lifecycle-trace">{{trace}}</text></view>'],
    ['pages/empty/index.js', 'Page({ onLoad() { getApp().trace = [] } })'],
    ['pages/empty/index.wxml', '<view>empty</view>'],
    ['components/child.json', '{"component":true}'],
    ['components/child.js', `Component({
    data: { injected: 'pending' },
    lifetimes: {
      created() { getApp().trace.push('child:created') },
      attached() {
        const pages = getCurrentPages()
        const page = pages[pages.length - 1]
        this.setData({ injected: page && page.providedValue || 'missing-page' })
        getApp().trace.push('child:attached:' + this.data.injected)
      },
      ready() { getApp().trace.push('child:ready') },
    },
  })`],
    ['components/child.wxml', '<text id="injected-value">{{injected}}</text>'],
  ]
}

export const componentPageLifecycleFiles = createComponentPageLifecycleFiles()
