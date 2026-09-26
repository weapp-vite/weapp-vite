export const initialConditionalBranchFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({ events: [] })'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { notice: '/components/notice/index' } })],
  ['pages/index/index.js', 'Page({ inspect() { return getApp().events } })'],
  ['pages/index/index.wxml', '<notice text="{{[\'Alpha\', \'Beta\']}}" direction="column" />'],
  ['components/notice/index.json', JSON.stringify({ component: true, usingComponents: { 'row-child': '/components/row/index', 'column-child': '/components/column/index' } })],
  ['components/notice/index.js', `Component({
    data: { show: true },
    properties: { text: { type: null, value: [] }, direction: { type: String, value: 'row' } },
    lifetimes: {
      created() { getApp().events.push('notice:created') },
      attached() { getApp().events.push('notice:attached') },
    },
  })`],
  ['components/notice/index.wxml', '<block wx:if="{{show}}"><view><block wx:if="{{direction === \'column\'}}"><column-child text="{{text}}" /></block><block wx:else><row-child text="{{text}}" /></block></view></block>'],
  ...['row', 'column'].flatMap(kind => [
    [`components/${kind}/index.json`, JSON.stringify({ component: true })],
    [`components/${kind}/index.wxml`, `<view id="${kind}">${kind}: {{text}}</view>`],
    [`components/${kind}/index.js`, `Component({
      properties: { text: { type: null, value: '' } },
      lifetimes: {
        created() { getApp().events.push('${kind}:created') },
        attached() { getApp().events.push('${kind}:attached') },
        ready() { getApp().events.push('${kind}:ready') },
        detached() { getApp().events.push('${kind}:detached') },
      },
    })`],
  ] as Array<[string, string]>),
]

// 真实微信 DevTools 的首次渲染：被 props 替换的初始分支仍收到 ready，但没有 attached/detached。
export const initialConditionalBranchEvents = [
  'row:created',
  'notice:created',
  'column:created',
  'notice:attached',
  'column:attached',
  'row:ready',
  'column:ready',
]
