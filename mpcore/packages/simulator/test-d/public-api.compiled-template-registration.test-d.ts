import type { BrowserHeadlessSession, HeadlessSession, HeadlessTestingSessionHandle } from '..'
import { expectError, expectType } from 'tsd'
import { createBrowserHeadlessSession, createBrowserVirtualFiles, createHeadlessSession, launch } from '..'

const compiledTemplatePaths = ['pages/index/index.wxml'] as const
const files = createBrowserVirtualFiles([])
expectType<HeadlessSession>(createHeadlessSession({ projectPath: '.', compiledTemplatePaths }))
expectType<BrowserHeadlessSession>(createBrowserHeadlessSession({ files, compiledTemplatePaths }))
expectType<Promise<HeadlessTestingSessionHandle>>(launch({ projectPath: '.', compiledTemplatePaths }))
expectError(createHeadlessSession({ projectPath: '.', compiledTemplatePaths: 'pages/index/index.wxml' }))
expectError(createBrowserHeadlessSession({ files, compiledTemplatePaths: [false] }))
expectError(launch({ projectPath: '.', compiledTemplatePaths: [1] }))

declare const node: HeadlessSession
declare const browser: BrowserHeadlessSession
declare const testing: HeadlessTestingSessionHandle
expectType<boolean>(node.reloadTemplates())
expectType<boolean>(browser.reloadTemplates())
expectType<Promise<boolean>>(testing.reloadTemplates())
expectError(node.reloadTemplates('pages/index/index.wxml'))
expectError(browser.reloadTemplates([]))
expectError(testing.reloadTemplates(true))
