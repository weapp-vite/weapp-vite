import type { Page } from '@weapp-vite/miniprogram-automator'
import { expectError, expectType } from 'tsd'

declare const page: Page
expectType<number>(page.pageId)
expectError(page.pageId = 1)
