import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { runPrinterChecks } from './printChecks'
import { printerCases, rejectedPrinterCases } from './printerCases'

function printer(mode: 'map' | 'code') {
  return {
    sha256: '0'.repeat(64),
    print(source: string, filename: string) {
      if (source.includes('\uD800')) {
        throw new Error('Experimental script input contains lone UTF-16 surrogates')
      }
      const rejected = rejectedPrinterCases.find(sample => sample.source === source && sample.filename === filename)
      if (rejected) {
        return { status: rejected.status, parseDiagnostics: [], semanticDiagnostics: [] }
      }
      const broken = source === printerCases[0]!.source
      const map = new MagicString(source).generateMap({ hires: true, includeContent: true, source: filename }).toString()
      return { status: 'ok' as const, code: broken && mode === 'code' ? 'const = ;' : source, map: broken && mode === 'map' ? 'not-json' : map, parseDiagnostics: [], semanticDiagnostics: [] }
    },
  }
}

describe('printer difference collection', () => {
  it.each(['map', 'code'] as const)('preserves raw bad %s output and continues collecting later differences', (mode) => {
    const report = runPrinterChecks(printer(mode), [])
    expect(report.observations).toHaveLength(printerCases.length * 2)
    expect(report.observations.slice(0, 2).every(observation => observation.comparisonError && !observation.comparisonPassed)).toBe(true)
    expect(report.observations.slice(2).every(observation => observation.comparisonPassed)).toBe(true)
    expect(report.observations[0]!.result[mode]).toBe(mode === 'map' ? 'not-json' : 'const = ;')
    expect(report.rejected).toHaveLength(rejectedPrinterCases.length)
    expect(report.surrogateRejected).toBe(true)
  })
})
