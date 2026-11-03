import { nativeBarePropertiesFiles } from './nativeBareProperties'

export const sharedTemplateExpressionValues = {
  'data-single-escape': String.raw`a\x27b`,
  'data-double-escape': String.raw`a\x22b`,
  'data-single-tail': 'tail\\',
  'data-double-tail': 'tail\\',
  'data-single-mixed': String.raw`a\\x27b`,
  'data-double-mixed': String.raw`a\\x22b`,
  'data-symbols': '<>&',
  'data-comparison': 'true',
  'data-bitwise': '3',
  'data-expression-entity': '&amp;',
} as const

// 完整属性层字节通过官方 WCC，语义期待取自真实 native 与 Vue 页面；WXS 内部仍按 JavaScript 执行。
const expressionSource = String.raw`<view id="setter-expressions"
  data-static-entity="&amp;"
  data-single-escape="{{'a\\'b'}}"
  data-double-escape="{{\"a\\\"b\"}}"
  data-single-tail="{{'tail\\\\'}}"
  data-double-tail="{{\"tail\\\\\"}}"
  data-single-mixed="{{'a\\\\\\'b'}}"
  data-double-mixed="{{\"a\\\\\\\"b\"}}"
  data-symbols="{{'<>&'}}"
  data-comparison="{{1 < 2 && 3 > 2}}"
  data-bitwise="{{7 & 3}}"
  data-expression-entity="{{'&amp;'}}">expressions</view>`

const commentedWxsSource = '<!-- <wxs module="commentedExternal" src="./must-not-load.wxs"></wxs> --><!-- <wxs module="commentedInline">exports.value = \'must-not-execute\';</wxs> -->'

export function createSharedTemplateParserFiles() {
  const files = new Map(nativeBarePropertiesFiles)
  files.set('pages/index/index.wxml', commentedWxsSource + String.raw`<wxs module="tools">var fraction = (function () {}) / 2; module.exports = { closing: "</wxs>", division: fraction !== fraction ? 'function-division' : 'wrong' };</wxs><template name="row"><bare-probe class="cloned" payload payload="{{false}}" title="a\"b" data-path=path\file data-entity="&amp;" data-closing="{{tools.closing}}" data-division="{{tools.division}}" data-commented-external="{{commentedExternal ? 'registered' : 'comment-ignored'}}" data-commented-inline="{{commentedInline ? commentedInline.value : 'comment-ignored'}}" /></template><template is="row"/><template is="row"/>` + expressionSource)
  return files
}
