import type { TemplateInputOptions } from '@weapp-vite/web'
import type { ChildNode } from 'domhandler'
import { createTemplate, renderTemplate } from '@weapp-vite/web'
import { weappWebPlugin } from '@weapp-vite/web/plugin'
import { createTemplate as createRuntimeTemplate, renderTemplate as renderRuntimeTemplate } from '@weapp-vite/web/runtime'
import { createTemplate as createPolyfillTemplate, renderTemplate as renderPolyfillTemplate } from '@weapp-vite/web/runtime/polyfill'
import { expectAssignable, expectError, expectType } from 'tsd'

const input: TemplateInputOptions = { platform: 'weapp', syntax: 'xml', rawTags: ['wxs', 'script'] }
const nodes: ChildNode[] = []
expectType<string>(renderTemplate(nodes))
expectType<string>(renderRuntimeTemplate(nodes, { ready: true }))
expectType<string>(renderPolyfillTemplate(nodes))
expectAssignable<(scope?: Record<string, any>, context?: object) => string>(createTemplate('<view />', input))
expectType<string>(createRuntimeTemplate('<view />', { platform: 'jd', syntax: 'xml' })())
expectType<string>(createPolyfillTemplate('<view />', { platform: 'qq' })())
expectType<string>(createTemplate('<view />', { platform: 'ks' })())
weappWebPlugin({ templateInput: input })
expectError(createTemplate('<view />', { platform: 'web' }))
expectError(createTemplate('<view />', { syntax: 'html' }))
expectError(createTemplate('<view />', { rawTags: [1] }))
expectError(weappWebPlugin({ templateInput: { platform: 'web' } }))
expectError(renderTemplate([{ kind: 'element', name: 'view', attributes: [], children: [], start: 0, end: 8 }]))
