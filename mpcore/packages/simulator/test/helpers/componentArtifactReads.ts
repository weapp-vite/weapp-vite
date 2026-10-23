export const componentArtifactReadFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { 'probe-card': 'probe-card', 'unused-card': 'unused-card' } })],
  ['pages/index/index.js', 'Page({})'],
  ['pages/index/index.wxml', '<probe-card id="probe" />'],
  ['miniprogram_npm/probe-card/index.json', JSON.stringify({ component: true })],
  ['miniprogram_npm/probe-card/index.js', `Component({ data: {
    label: require('./label'),
    relativeLabel: require('./relative-label'),
    npmLabel: require('probe-label'),
    count: 0,
  } })`],
  ['miniprogram_npm/probe-card/label.js', 'module.exports = "module-source-loaded"'],
  ['miniprogram_npm/probe-card/relative-label/index.js', 'module.exports = "relative-directory-source"'],
  ['miniprogram_npm/probe-label/index.js', 'module.exports = "npm-directory-source"'],
  ['miniprogram_npm/probe-card/index.wxml', '<view id="probe-label">{{label}}/{{count}}</view><view id="directory-labels">{{relativeLabel}}/{{npmLabel}}</view>'],
]
