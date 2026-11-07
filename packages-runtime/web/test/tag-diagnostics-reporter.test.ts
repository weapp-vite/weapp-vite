import type { WxmlTagDiagnostic } from '../src/compiler/wxml/types'
import { describe, expect, it, vi } from 'vitest'
import { createTagDiagnosticReporter } from '../src/plugin/tagDiagnostics'

const diagnostic: WxmlTagDiagnostic = { tag: 'buton', reason: 'unknown', filename: 'pages/home/index.wxml', line: 2, column: 3 }

describe('tag diagnostic ownership', () => {
  it('treats component-map insertion order as the same registration scope and clears removed diagnostics', () => {
    const reporter = createTagDiagnosticReporter(undefined)
    reporter.configure({ root: '.', command: 'serve' })
    const context = { warn: vi.fn() }
    reporter.report('home', [diagnostic], { zebra: 'components/zebra', apple: 'components/apple' }, context)
    reporter.report('home', [diagnostic], { apple: 'components/apple', zebra: 'components/zebra' }, context)
    expect(context.warn).toHaveBeenCalledTimes(1)

    reporter.report('home', undefined, undefined, context)
    reporter.report('home', [diagnostic], undefined, context)
    expect(context.warn).toHaveBeenCalledTimes(2)
  })

  it('uses the console error channel when the host has no configured logger', () => {
    const reporter = createTagDiagnosticReporter({ warnings: { level: 'error' } })
    reporter.configure({ root: '.', command: 'serve' })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      reporter.report(diagnostic.filename, [diagnostic], undefined, {})
      expect(error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('<buton>'))
      expect(error).not.toHaveBeenCalledWith(expect.stringContaining('（入口'))
    }
    finally {
      error.mockRestore()
    }
  })

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
