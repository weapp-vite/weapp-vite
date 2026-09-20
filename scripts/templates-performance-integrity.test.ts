import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
/* eslint-disable-next-line e18e/ban-dependencies -- 回归验证跨平台脚本退出码。 */
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { assertTemplatesPerformanceComplete, collectTemplatesPerformanceFailures, parseTemplatesHmrReport } from './templates-performance-integrity'

function checkout() {
  return {
    templates: [{ id: 'native' }],
    build: {
      samples: [{ template: 'native', iteration: 1, status: 0, totalMs: 100 }],
      raw: { count: 1, failedCount: 0 },
      templates: [{ id: 'native' }],
    },
    hmr: {
      iterations: 1,
      summary: { templateCount: 1, scenarioCount: 1, measuredScenarioCount: 1, failedTemplateCount: 0, failedScenarioCount: 0, overBudgetCount: 1 },
      templates: [{ id: 'native', scenarioCount: 1, scenarios: [{ id: 'script', label: 'page script', group: 'native-script', samples: [{ totalMs: 20, wallMs: 50 }] }] }],
    },
  }
}

function completeReport() {
  return {
    buildIterations: 1,
    hmrIterations: 1,
    templateFilter: ['native'],
    hmrFilter: 'native',
    baseline: checkout(),
    optimized: checkout(),
    build: { rows: [{ id: 'native', comparable: true }], failed: [] },
    hmr: { rows: [{ key: 'native:script:page script', comparable: true }], failed: [] },
  }
}

describe('templates performance completeness gate', () => {
  it('accepts complete successful evidence without imposing a new performance budget', () => {
    expect(collectTemplatesPerformanceFailures(completeReport())).toEqual([])
    expect(() => assertTemplatesPerformanceComplete(completeReport())).not.toThrow()
  })

  it.each([
    ['failed build process', (report: any) => { report.optimized.build.samples[0].status = 1 }],
    ['signal termination without exit code', (report: any) => { delete report.baseline.build.samples[0].status }],
    ['failed build summary', (report: any) => { report.baseline.build.raw.failedCount = 1 }],
    ['failed build row', (report: any) => { report.build.failed.push(report.build.rows[0]) }],
    ['failed HMR row', (report: any) => { report.hmr.failed.push(report.hmr.rows[0]) }],
    ['failed HMR template', (report: any) => { report.optimized.hmr.templates[0].error = 'startup failed' }],
    ['failed HMR scenario', (report: any) => { report.optimized.hmr.templates[0].scenarios[0].error = 'update failed' }],
    ['failed HMR summary', (report: any) => { report.baseline.hmr.summary.failedScenarioCount = 1 }],
    ['missing HMR summary', (report: any) => { delete report.baseline.hmr.summary }],
    ['missing HMR report', (report: any) => { report.baseline.hmr = { templates: [] } }],
    ['failed HMR command with successful partial report', (report: any) => { report.baseline.hmrError = 'command killed' }],
    ['zero selected templates', (report: any) => { report.optimized.templates = [] }],
    ['missing selected template', (report: any) => { report.templateFilter.push('missing') }],
    ['missing selected HMR template', (report: any) => { report.hmrFilter = 'missing' }],
    ['filtered-out HMR scenario', (report: any) => { report.baseline.hmr.templates[0].scenarioCount = 2 }],
    ['unmeasured scenario', (report: any) => { report.baseline.hmr.templates[0].scenarios[0].samples = [] }],
    ['incomplete build iterations', (report: any) => { report.buildIterations = 2 }],
    ['duplicate build iteration', (report: any) => { report.baseline.build.samples.push(report.baseline.build.samples[0]) }],
    ['incomplete HMR iterations', (report: any) => { report.baseline.hmr.templates[0].scenarios[0].samples.push({ totalMs: 20, wallMs: 50 }) }],
    ['invalid timing', (report: any) => { report.baseline.hmr.templates[0].scenarios[0].samples[0].wallMs = null }],
    ['missing comparison row', (report: any) => { report.hmr.rows = [] }],
    ['duplicate comparison row', (report: any) => { report.build.rows.push(report.build.rows[0]) }],
    ['incomparable result', (report: any) => { report.hmr.rows[0].comparable = false }],
  ])('rejects %s', (_label, mutate) => {
    const report = completeReport()
    mutate(report)
    expect(() => assertTemplatesPerformanceComplete(report)).toThrow('failed integrity checks')
  })

  it('rejects malformed structures before comparison rendering', () => {
    expect(() => parseTemplatesHmrReport({ templates: [{ id: 'native', scenarios: null }] })).toThrow('invalid')
    expect(() => parseTemplatesHmrReport({ templates: [{ id: 'native', scenarios: [{ id: 'script', samples: [null] }] }] })).toThrow('invalid')
    expect(parseTemplatesHmrReport(checkout().hmr)).toEqual(checkout().hmr)
  })

  it.each(['complete', 'failed', 'missing-json', 'missing-markdown', 'malformed-json'])('returns the correct CLI status while preserving %s diagnostic artifacts', async (mode) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'templates-performance-gate-'))
    const report = completeReport()
    if (mode === 'failed') {
      report.optimized.build.samples[0]!.status = 1
    }
    const json = mode === 'malformed-json' ? '{' : JSON.stringify(report)
    try {
      if (mode !== 'missing-json') {
        await writeFile(path.join(directory, 'report.json'), json)
      }
      if (mode !== 'missing-markdown') {
        await writeFile(path.join(directory, 'report.md'), '# Diagnostic report\n')
      }
      const result = await execa(process.execPath, ['--import', 'tsx', 'scripts/check-templates-performance-report.ts'], {
        cwd: path.resolve(import.meta.dirname, '..'),
        env: { TEMPLATES_PERF_REPORT_DIR: directory },
        reject: false,
      })
      expect(result.exitCode).toBe(mode === 'complete' ? 0 : 1)
      if (mode !== 'missing-json') {
        expect(await readFile(path.join(directory, 'report.json'), 'utf8')).toBe(json)
      }
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
