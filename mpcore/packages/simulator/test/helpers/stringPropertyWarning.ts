export const stringPropertyWarningFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { probe: '/components/probe' } })],
  ['pages/index/index.js', `Page({ data: { value: null }, update(value) { this.setData({ value }) } })`],
  ['pages/index/index.wxml', '<probe text="{{value}}" /><probe /><probe text="valid" />'],
  ['components/probe.json', JSON.stringify({ component: true })],
  ['components/probe.js', `Component({ properties: { text: { type: String, value: '' } } })`],
  ['components/probe.wxml', '<text class="value">{{text}}</text>'],
]

export const stringPropertyWarning = '[Component] property "text" of "components/probe" received type-uncompatible value: expected <String> but get null value. Use empty string instead.'
