import type { Page } from '..'
import { expectError, expectType } from 'tsd'

declare const page: Page
expectType<number>(page.pageId)
expectError(page.pageId = 1)
