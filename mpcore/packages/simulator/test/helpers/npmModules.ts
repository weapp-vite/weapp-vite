export function npmModuleFiles(request = 'ui/dialog'): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: 'dist' })],
    ['dist/app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['dist/app.js', 'App({})'],
    ['dist/pages/index/index.js', `Page({ data: { label: require(${JSON.stringify(request)}).label } })`],
    ['dist/pages/index/index.wxml', '<view id="module-label">{{label}}</view>'],
    ['dist/miniprogram_npm/ui/dialog/index.js', `
const helper = require('tslib')
const shared = require('@example/shared')
const detail = require('@example/shared/detail')
const options = require('./options.json')
module.exports = { label: [helper.label, shared.label, detail.label, options.label].join(':') }
`],
    ['dist/miniprogram_npm/ui/dialog/options.json', JSON.stringify({ label: 'json' })],
    ['dist/miniprogram_npm/ui/miniprogram_npm/tslib/index.js', 'exports.label = "nested-helper"'],
    ['dist/miniprogram_npm/tslib/index.js', 'exports.label = "root-helper"'],
    ['dist/miniprogram_npm/@example/shared/index.js', 'exports.label = "root-shared"'],
    ['dist/miniprogram_npm/@example/shared/detail.js', 'exports.label = "detail"'],
    ['miniprogram_npm/outside/index.js', 'exports.label = "outside-root"'],
    ['dist/node_modules/host-only/index.js', 'exports.label = "host-only"'],
  ]
}
