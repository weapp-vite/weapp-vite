import type { BrowserPageStyles, BrowserRenderedPageTree } from '..'
import { expectError, expectType } from 'tsd'
import { createBrowserHeadlessSession, createBrowserVirtualFiles, resolveBrowserPageStyles } from '..'

const files = createBrowserVirtualFiles([])
const styles = resolveBrowserPageStyles(files, 'pages/index', { miniprogramRootPath: '/mini', styleIsolation: 'page-isolated' })
expectType<BrowserPageStyles>(styles)
expectType<string>(styles.cssText)
expectType<string[]>(styles.dependencies)
expectType<boolean>(styles.appWxssEnabled)
const rendered = createBrowserHeadlessSession({ files }).renderCurrentPage()
expectType<BrowserRenderedPageTree>(rendered)
expectType<BrowserPageStyles>(rendered.styles)
expectError(resolveBrowserPageStyles(files, 42))
expectError(resolveBrowserPageStyles(files, 'pages/index', { styleIsolation: false }))
