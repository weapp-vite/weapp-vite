import type { WxmlRemoveOptions as ConfigRemoveOptions } from 'weapp-vite/config'
import type { WeappViteConfig, WxmlRemoveAttrRule, WxmlRemoveOptions } from 'weapp-vite/types'
import { expectAssignable, expectNotAssignable } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

const scoped: WxmlRemoveAttrRule = { tag: ['view', 'text'], name: 'data-debug-*' }
const remove: WxmlRemoveOptions = { attr: ['data-testid', scoped], tag: ['debug-panel'], comment: true }
expectAssignable<ConfigRemoveOptions>(remove)
expectAssignable<WeappViteConfig>({ wxml: { remove } })
expectAssignable<WeappViteConfig>({ wxml: { remove: false } })
expectAssignable<WeappViteConfig>({ wxml: { remove: true } })
defineConfig(({ mode }) => ({ weapp: { wxml: { remove: mode === 'production' ? remove : false } } }))
expectNotAssignable<WxmlRemoveOptions>({ attr: [/test/] })
expectNotAssignable<WxmlRemoveOptions>({ attr: [{ tag: 'view' }] })
expectNotAssignable<WxmlRemoveOptions>({ tag: true })
expectNotAssignable<WeappViteConfig>({ wxml: { removeAttributes: ['data-testid'] } })
expectNotAssignable<WeappViteConfig>({ wxml: { removeComment: false } })
expectNotAssignable<WeappViteConfig>({ vue: { template: { removeComments: false } } })
