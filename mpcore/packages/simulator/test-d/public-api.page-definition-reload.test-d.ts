import type { BrowserHeadlessSession, HeadlessSession, HeadlessTestingSessionHandle } from '..'
import { expectError, expectType } from 'tsd'

declare const node: HeadlessSession
declare const browser: BrowserHeadlessSession
declare const testing: HeadlessTestingSessionHandle

expectType<boolean>(node.reloadPageDefinition('/pages/index/index'))
expectType<boolean>(browser.reloadPageDefinition('/pages/index/index'))
expectType<Promise<boolean>>(testing.reloadPageDefinition('/pages/index/index'))
expectError(node.reloadPageDefinition(1))
expectError(browser.reloadPageDefinition({ route: '/pages/index/index' }))
expectError(testing.reloadPageDefinition())
