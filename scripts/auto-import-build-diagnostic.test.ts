import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { parse } from 'yaml'
import { autoImportBuildDiagnosticOrder, autoImportBuildDiagnosticPlan, validateAutoImportBuildDiagnosticIdentity } from './autoImportBuildDiagnostic/plan'
import { injectAutoImportBuildDiagnostics, isAutoImportBuildDiagnosticEnabled } from './benchmarkTemplatesPerformance/autoImportBuildDiagnostics/fixture'

const candidateSha = 'a'.repeat(40)
const identity = { EXPECTED_CANDIDATE_SHA: candidateSha, CANDIDATE_SHA: candidateSha, BASELINE_SHA: autoImportBuildDiagnosticPlan.baselineSha, GITHUB_RUN_ATTEMPT: '1' }

it('does not change the original fixture unless the private flag is exactly one', () => {
  const source = 'export default defineConfig({ plugins: [] })'
  expect(isAutoImportBuildDiagnosticEnabled({})).toBe(false)
  expect(isAutoImportBuildDiagnosticEnabled({ AUTO_IMPORT_BUILD_DIAGNOSTIC: 'true' })).toBe(false)
  expect(isAutoImportBuildDiagnosticEnabled({ AUTO_IMPORT_BUILD_DIAGNOSTIC: '1' })).toBe(true)
  expect(injectAutoImportBuildDiagnostics(source, false, 'file:///diagnostic.ts', [])).toBe(source)
  const injected = injectAutoImportBuildDiagnostics(source, true, 'file:///diagnostic.ts', [{ path: '/fixture', label: '<project>' }])
  expect(injected).toContain('createAutoImportBuildDiagnosticsPlugin(true')
  expect(injected).toContain('"file:///diagnostic.ts"')
  expect(() => injectAutoImportBuildDiagnostics(injected, true, 'file:///diagnostic.ts', [])).toThrow('original')
  expect(() => injectAutoImportBuildDiagnostics('export default {}', true, 'file:///diagnostic.ts', [])).toThrow('original')
})

it('freezes seven pairs, the original baseline and complete 69 manual build lifecycle', () => {
  expect(autoImportBuildDiagnosticPlan).toMatchObject({ baselineSha: 'e7862e61dd83e3b9e356ac1e176267b31ab298af', pairCount: 7, configurations: ['69:manual'], phases: ['first', 'repeat'] })
  expect(Array.from({ length: 7 }, (_, round) => autoImportBuildDiagnosticOrder(round))).toEqual([
    ['baseline', 'candidate'],
    ['candidate', 'baseline'],
    ['baseline', 'candidate'],
    ['candidate', 'baseline'],
    ['baseline', 'candidate'],
    ['candidate', 'baseline'],
    ['baseline', 'candidate'],
  ])
  expect(() => validateAutoImportBuildDiagnosticIdentity(identity)).not.toThrow()
  for (const change of [{ CANDIDATE_SHA: 'b'.repeat(40) }, { EXPECTED_CANDIDATE_SHA: 'main' }, { BASELINE_SHA: 'b'.repeat(40) }, { GITHUB_RUN_ATTEMPT: '2' }]) {
    expect(() => validateAutoImportBuildDiagnosticIdentity({ ...identity, ...change })).toThrow('original fixed baseline')
  }
})

it('keeps the diagnostic dispatch separate from the original performance gate and serial on macOS', async () => {
  const root = path.resolve(import.meta.dirname, '..')
  const workflow = parse(await readFile(path.join(root, '.github/workflows/auto-import-build-diagnostic.yml'), 'utf8'))
  expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch'])
  expect(workflow.permissions).toEqual({ contents: 'read' })
  expect(workflow.jobs.diagnose['runs-on']).toBe('macos-latest')
  expect(workflow.jobs.diagnose.strategy).toBeUndefined()
  const steps = workflow.jobs.diagnose.steps
  expect(steps.find((step: { name?: string }) => step.name === 'Check out the fixed baseline').with.ref).toBe(autoImportBuildDiagnosticPlan.baselineSha)
  expect(steps.find((step: { name?: string }) => step.name === 'Collect paired opt-in diagnostics').run).toContain('autoImportBuildDiagnostic/runner.ts')
  expect(steps.find((step: { name?: string }) => step.name === 'Record diagnostic boundary').run).toContain('does not rerun, replace or publish')
  const collector = await readFile(path.join(root, 'scripts/performanceGate/autoImport.ts'), 'utf8')
  expect(collector).toContain('AUTO_IMPORT_BUILD_DIAGNOSTIC: \'0\'')
  const runner = await readFile(path.join(root, 'scripts/autoImportBuildDiagnostic/runner.ts'), 'utf8')
  expect(runner).toContain('AUTO_IMPORT_BUILD_DIAGNOSTIC: \'1\'')
  expect(runner).toContain('BENCH_SCENARIOS: \'69\'')
  expect(runner).toContain('BENCH_ITERATIONS: \'1\'')
  expect(runner).toContain('AUTO_IMPORT_BENCH_PAIRED: \'1\'')
})

it('uses runner context only in step environments and keeps the collector and upload paths aligned', async () => {
  const root = path.resolve(import.meta.dirname, '..')
  const workflow = parse(await readFile(path.join(root, '.github/workflows/auto-import-build-diagnostic.yml'), 'utf8'))
  const job = workflow.jobs.diagnose
  expect(job.env).not.toHaveProperty('REPORT_ROOT')
  expect(JSON.stringify(job.env)).not.toMatch(/\$\{\{\s*runner(?:\.|\[)/)
  const collector = job.steps.find((step: { name?: string }) => step.name === 'Collect paired opt-in diagnostics')
  const upload = job.steps.find((step: { name?: string }) => step.name === 'Upload completed and partial diagnostics')
  // eslint-disable-next-line no-template-curly-in-string -- 校验 GitHub Actions 的字面量表达式，不能在测试中提前插值。
  expect(collector.env.REPORT_ROOT).toBe('${{ runner.temp }}/auto-import-build-diagnostic')
  expect(upload.with.path).toBe(collector.env.REPORT_ROOT)
})
