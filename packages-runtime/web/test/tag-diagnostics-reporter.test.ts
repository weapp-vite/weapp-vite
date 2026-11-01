import type { WxmlTagDiagnostic } from '../src/compiler/wxml/types'
import { describe, expect, it, vi } from 'vitest'
import { createTagDiagnosticReporter } from '../src/plugin/tagDiagnostics'

const diagnostic: WxmlTagDiagnostic = { tag: 'buton', reason: 'unknown', filename: 'pages/home/index.wxml', line: 2, column: 3 }

describe('tag diagnostic ownership', () => {
  it('deduplicates each source and registration owner without losing newly introduced mistakes', () => {
    const reporter = createTagDiagnosticReporter(undefined)
    reporter.configure({ root: '.', command: 'serve' })
    const context = { warn: vi.fn() }
    reporter.report('home', [diagnostic, diagnostic], {}, context)
    reporter.report('home', [diagnostic], {}, context)
    expect(context.warn).toHaveBeenCalledTimes(1)
    reporter.report('other', [diagnostic], {}, context)
    reporter.report('home', [diagnostic, { ...diagnostic, filename: 'parts/list.wxml' }], {}, context)
    expect(context.warn).toHaveBeenCalledTimes(3)
    reporter.report('home', [], { buton: 'registered' }, context)
    reporter.report('home', [diagnostic], {}, context)
    expect(context.warn).toHaveBeenCalledTimes(4)
  })

  it('respects dedupe false and resets when the same plugin receives a new dev configuration', () => {
    const reporter = createTagDiagnosticReporter({ warnings: { dedupe: false } })
    const config = { root: '.', command: 'serve' }
    reporter.configure(config)
    const context = { warn: vi.fn() }
    reporter.report('home', [diagnostic], {}, context)
    reporter.report('home', [diagnostic], {}, context)
    reporter.configure(config)
    reporter.report('home', [diagnostic], {}, context)
    expect(context.warn).toHaveBeenCalledTimes(3)
  })
})
