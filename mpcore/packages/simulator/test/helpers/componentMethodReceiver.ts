export const componentMethodReceiverFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { 'mcp-probe': '/components/mcp-probe/index' } })],
  ['pages/index/index.js', 'Page({})'],
  ['pages/index/index.wxml', '<mcp-probe id="first" /><mcp-probe id="second" />'],
  ['components/mcp-probe/index.json', JSON.stringify({ component: true })],
  ['components/mcp-probe/index.js', `Component({
    data: {
      label: 'component-initial',
      previousLabel: '',
      calls: 0,
      undefinedCalls: 0,
      asyncCalls: 0,
      syncFailures: 0,
      asyncFailures: 0,
    },
    methods: {
      mark(value) {
        this.setData({
          previousLabel: this.data.label,
          label: value,
          calls: this.data.calls + 1,
        })
        return 'component:' + value
      },
      completeWithoutValue() {
        this.setData({ label: 'undefined-method', undefinedCalls: this.data.undefinedCalls + 1 })
      },
      async completeAsync(value) {
        this.setData({ asyncCalls: this.data.asyncCalls + 1 })
        await Promise.resolve()
        this.setData({ label: value })
        return { label: this.data.label, calls: this.data.asyncCalls }
      },
      fail() {
        this.setData({ syncFailures: this.data.syncFailures + 1 })
        throw new Error('component-method-failed')
      },
      async failAsync() {
        this.setData({ asyncFailures: this.data.asyncFailures + 1 })
        throw new Error('component-method-failed-async')
      },
    },
  })`],
  ['components/mcp-probe/index.wxml', '<view class="component-label">{{label}}</view>'],
]
