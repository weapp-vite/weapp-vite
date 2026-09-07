import type { Element, MiniProgram, Page } from '..'
import { expectError, expectType } from 'tsd'

declare const miniProgram: MiniProgram
declare const page: Page

expectType<Promise<Page>>(miniProgram.currentPage())
expectType<Promise<Page>>(miniProgram.currentPage({ appFunctionFallback: false, pageStackFallback: false, retries: 1, timeout: 300 }))
expectError(miniProgram.currentPage({ pageStackFallback: 'false' }))
expectType<Promise<Page>>(miniProgram.reLaunch('/pages/index/index'))
expectType<Promise<Page>>(miniProgram.navigateTo('/pages/detail/index'))
expectType<Promise<Page>>(miniProgram.redirectTo('/pages/detail/index'))
expectType<Promise<Page>>(miniProgram.switchTab('/pages/profile/index'))
expectType<Promise<Page>>(miniProgram.navigateBack())
expectType<Promise<Element[]>>(page.getElementsByXpath('//view', { timeout: 3_000 }))
expectType<Promise<Element | null>>(page.getElementByXpath('//view'))
expectError(miniProgram.reLaunch(1))
expectError(page.getElementsByXpath(1))
expectError(page.getElementsByXpath('//view', { timeout: '3000' }))
