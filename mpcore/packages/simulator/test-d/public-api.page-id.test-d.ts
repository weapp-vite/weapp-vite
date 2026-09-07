import type { HeadlessTestingPageHandle } from '..'
import { expectError, expectType } from 'tsd'

declare const page: HeadlessTestingPageHandle
expectType<number>(page.pageId)
expectError(page.pageId = 1)
