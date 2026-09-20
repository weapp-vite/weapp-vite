import type { BrowserRendererContext, RuntimeRendererContext } from '..'
import { expectType } from 'tsd'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '..'

declare const browserContext: BrowserRendererContext
declare const runtimeContext: RuntimeRendererContext

expectType<unknown>(browserContext.componentScopes.get('page:index')?.wxs?.platformTools)
expectType<unknown>(runtimeContext.componentScopes.get('page:index')?.wxs?.platformTools)

const files = createBrowserVirtualFiles([
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.js', 'Page({data:{platform:"weapp"}})'],
  ['pages/index/index.wxml', '<wxs module="tools" src="./tools.wxs" /><view>{{tools.label(platform)}}</view>'],
  ['pages/index/tools.wxs', 'exports.label = function(value) { return value }'],
])
const session = createBrowserHeadlessSession({ files })
session.reLaunch('/pages/index/index')
expectType<string>(session.renderCurrentPage().wxml)
