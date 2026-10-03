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

export function npmMappedComponentFiles(): Array<[string, string]> {
  const files: Array<[string, string]> = [
    ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: 'dist' })],
    ['dist/app.json', JSON.stringify({ pages: ['pages/index/index'], subPackages: [{ root: 'customized', pages: ['pages/npm-options/index'] }] })],
    ['dist/app.js', 'App({})'],
    ['dist/pages/index/index.js', 'Page({})'],
    ['dist/pages/index/index.wxml', '<view>npm output options</view>'],
    ['dist/customized/pages/npm-options/index.json', JSON.stringify({ usingComponents: {
      'callback-button': '/customized/custom-components/ui/button/button',
      'mapped-button': '/manual-output/miniprogram_npm/ui/button/button',
    } })],
    ['dist/customized/pages/npm-options/index.js', `Page({
      data: { callbackCount: 0, mappedCount: 0, disabledCount: 0 },
      onCallbackTap() { this.setData({ callbackCount: this.data.callbackCount + 1 }) },
      onMappedTap() { this.setData({ mappedCount: this.data.mappedCount + 1 }) },
      onDisabledTap() { this.setData({ disabledCount: this.data.disabledCount + 1 }) }
    })`],
    ['dist/customized/pages/npm-options/index.wxml', `
      <callback-button t-id="npm-callback-button" content="callback output" bind:tap="onCallbackTap" />
      <mapped-button t-id="npm-mapped-button" content="manual mapped output" bind:tap="onMappedTap" />
      <callback-button t-id="npm-disabled-button" content="disabled callback output" disabled="{{true}}" bind:tap="onDisabledTap" />
      <view id="npm-counts">{{callbackCount}}/{{mappedCount}}/{{disabledCount}}</view>
    `],
  ]
  for (const [directory, dependencyDirectory, label] of [
    ['customized/custom-components/ui', 'customized/miniprogram_npm', 'subpackage helper'],
    ['manual-output/miniprogram_npm/ui', 'manual-output/miniprogram_npm', 'mapped helper'],
  ]) {
    files.push(
      [`dist/${directory}/button/button.json`, JSON.stringify({ component: true })],
      [`dist/${directory}/button/button.js`, `const helper = require('npm-helper')
        Component({
          properties: { tId: String, content: String, disabled: { type: null } },
          data: { helper: helper.label },
          methods: { handleTap() { if (!this.data.disabled) this.triggerEvent('tap') } }
        })`],
      [`dist/${directory}/button/button.wxml`, '<button id="{{tId}}" catch:tap="handleTap">{{content}}</button><view class="npm-helper">{{helper}}</view>'],
      [`dist/${dependencyDirectory}/npm-helper/index.js`, `exports.label = ${JSON.stringify(label)}`],
    )
  }
  return files
}
