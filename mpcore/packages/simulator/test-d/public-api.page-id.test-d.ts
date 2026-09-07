import type { HeadlessTestingPageHandle, HeadlessTestingSessionHandle } from '..'
import { expectError, expectType } from 'tsd'

declare const page: HeadlessTestingPageHandle
expectType<number>(page.pageId)
expectError(page.pageId = 1)
expectType<string>(page.path)
expectError(page.path = '__plugin__/provider/pages/index')

declare const session: HeadlessTestingSessionHandle
expectType<Promise<HeadlessTestingPageHandle>>(session.waitForCurrentPage('__plugin__/provider/pages/index'))
