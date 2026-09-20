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

export function npmComponentFiles(): Array<[string, string]> {
  const usingComponents = {
    'ui-dialog': 'ui/dialog/dialog',
    'scoped-card': '@example/card/index',
    'local-label': './local',
    'root-label': '/components/root',
  }
  const files: Array<[string, string]> = [
    ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: 'dist' })],
    ['dist/app.json', JSON.stringify({ pages: ['pages/index/index'], subpackages: [{ root: 'sub', pages: ['page/index'] }] })],
    ['dist/app.js', 'App({})'],
    ['dist/miniprogram_npm/ui/dialog/dialog.json', JSON.stringify({ component: true, usingComponents: { 'ui-popup': '../popup/popup', 'ui-icon': '@example/icon/index' } })],
    ['dist/miniprogram_npm/ui/dialog/dialog.js', 'Component({})'],
    ['dist/miniprogram_npm/ui/dialog/dialog.wxml', '<view><text id="dialog-label">root dialog</text><ui-popup/><ui-icon/></view>'],
    ['dist/sub/miniprogram_npm/ui/dialog/dialog.json', JSON.stringify({ component: true })],
    ['dist/sub/miniprogram_npm/ui/dialog/dialog.js', 'Component({})'],
    ['dist/sub/miniprogram_npm/ui/dialog/dialog.wxml', '<view id="dialog-label">subpackage dialog</view>'],
  ]
  for (const page of ['pages/index', 'sub/page']) {
    files.push(
      [`dist/${page}/index.js`, 'Page({})'],
      [`dist/${page}/index.json`, JSON.stringify({ usingComponents })],
      [`dist/${page}/index.wxml`, '<view><ui-dialog/><scoped-card/><local-label/><root-label/></view>'],
      [`dist/${page}/local.js`, 'Component({})'],
      [`dist/${page}/local.json`, JSON.stringify({ component: true })],
      [`dist/${page}/local.wxml`, '<view id="local-label">local component</view>'],
    )
  }
  for (const [component, id, label] of [
    ['miniprogram_npm/ui/popup/popup', 'popup-label', 'relative popup'],
    ['miniprogram_npm/ui/miniprogram_npm/@example/icon/index', 'icon-label', 'nested icon'],
    ['miniprogram_npm/@example/icon/index', 'icon-label', 'root icon'],
    ['miniprogram_npm/@example/card/index', 'scoped-label', 'scoped component'],
    ['components/root', 'root-label', 'root component'],
  ]) {
    files.push(
      [`dist/${component}.js`, 'Component({})'],
      [`dist/${component}.json`, JSON.stringify({ component: true })],
      [`dist/${component}.wxml`, `<view id="${id}">${label}</view>`],
    )
  }
  return files
}
