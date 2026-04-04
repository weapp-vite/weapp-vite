import path from 'pathe'

export const SHARED_HMR_DIRNAME = 'shared-hmr'
export const SHARED_IMPORT_TEMPLATE_BASENAME = 'card-template.wxml'
export const SHARED_INCLUDE_TEMPLATE_BASENAME = 'card-include.wxml'
export const SHARED_WXS_BASENAME = 'helper.wxs'

export function resolveSharedHmrPaths(appRoot: string) {
  const srcRoot = path.join(appRoot, 'src')
  const sharedDir = path.join(srcRoot, SHARED_HMR_DIRNAME)

  return {
    hmrPageWxml: path.join(srcRoot, 'pages/hmr/index.wxml'),
    hmrSfcVue: path.join(srcRoot, 'pages/hmr-sfc/index.vue'),
    sharedDir,
    sharedImportTemplate: path.join(sharedDir, SHARED_IMPORT_TEMPLATE_BASENAME),
    sharedIncludeTemplate: path.join(sharedDir, SHARED_INCLUDE_TEMPLATE_BASENAME),
    sharedWxs: path.join(sharedDir, SHARED_WXS_BASENAME),
  }
}

export function resolveSharedHmrRelativeImports() {
  return {
    importTemplateRelative: `../../${SHARED_HMR_DIRNAME}/${SHARED_IMPORT_TEMPLATE_BASENAME}`,
    includeTemplateRelative: `../../${SHARED_HMR_DIRNAME}/${SHARED_INCLUDE_TEMPLATE_BASENAME}`,
    helperRelative: `../../${SHARED_HMR_DIRNAME}/${SHARED_WXS_BASENAME}`,
  }
}

export function resolveSharedHmrScriptModuleExt(platform: 'weapp' | 'alipay' | 'tt') {
  return platform === 'weapp' ? 'wxs' : 'sjs'
}

export function buildSharedImportTemplate(marker: string) {
  return [
    '<template name="hmrSharedCard">',
    `  <view class="shared-template">${marker}: {{ label }}</view>`,
    '</template>',
    '',
  ].join('\n')
}

export function buildSharedIncludeTemplate(marker: string) {
  return `<view class="shared-include">${marker}</view>\n`
}

export function buildSharedWxs(marker: string) {
  return [
    'module.exports = {',
    '  label: function() {',
    `    return '${marker}'`,
    '  },',
    '}',
    '',
  ].join('\n')
}

export function buildSharedHmrPageWxml(importTemplatePath: string, includeTemplatePath: string, helperPath: string) {
  return [
    `<import src="${importTemplatePath}" />`,
    `<include src="${includeTemplatePath}" />`,
    `<wxs module="hmrShared" src="${helperPath}" />`,
    '<view class="page">',
    '  <view class="title">HMR</view>',
    '  <template is="hmrSharedCard" data="{{ label: hmrShared.label() }}" />',
    '  <view class="summary">ok: {{__e2e.ok}}</view>',
    '  <text class="details" selectable>{{__e2eText}}</text>',
    '</view>',
    '',
  ].join('\n')
}

export function buildSharedHmrVueSource(importTemplatePath: string, helperPath: string) {
  return [
    '<script lang="ts">',
    '/* HMR-SFC-SCRIPT */',
    'import { defineComponent } from \'wevu\'',
    '',
    'export default defineComponent({',
    '  data: () => ({',
    '    marker: \'HMR-SFC-SCRIPT\',',
    '  }),',
    '})',
    '</script>',
    '',
    '<template>',
    `  <import src="${importTemplatePath}" />`,
    `  <wxs module="hmrShared" src="${helperPath}" />`,
    '  <view class="hmr-sfc-page">',
    '    <view class="title">HMR-SFC</view>',
    '    <view class="marker">{{ marker }}</view>',
    '    <template is="hmrSharedCard" data="{{ label: hmrShared.label() }}" />',
    '  </view>',
    '</template>',
    '',
    '<style>',
    '/* HMR-SFC-STYLE */',
    '.hmr-sfc-page {',
    '  padding: 24rpx;',
    '}',
    '',
    '.title {',
    '  font-weight: 600;',
    '  margin-bottom: 16rpx;',
    '}',
    '',
    '.marker {',
    '  font-size: 28rpx;',
    '}',
    '</style>',
    '',
    '<json>',
    '{',
    '  "component": false',
    '}',
    '</json>',
    '',
  ].join('\n')
}
