import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { benchmarkModeSelected } from '../packages/weapp-vite/scripts/utils/benchmarkSelection'
import { isAutoImportHmrDiagnosticEnabled, isAutoImportHmrDiagnosticProfileEnabled } from '../packages/weapp-vite/scripts/utils/hmrDiagnostic'
import { measureFileMarkerUpdate } from '../packages/weapp-vite/scripts/utils/hmrOutput'

describe('auto-import HMR restore diagnostic', () => {
  it('keeps timing probes and candidate profiles disabled unless explicitly enabled', () => {
    expect(isAutoImportHmrDiagnosticEnabled({})).toBe(false)
    expect(isAutoImportHmrDiagnosticProfileEnabled({ AUTO_IMPORT_HMR_DIAGNOSTIC_PROFILE: '1' })).toBe(false)
    expect(isAutoImportHmrDiagnosticEnabled({ AUTO_IMPORT_HMR_DIAGNOSTIC: '1' })).toBe(true)
    expect(isAutoImportHmrDiagnosticProfileEnabled({ AUTO_IMPORT_HMR_DIAGNOSTIC: '1', AUTO_IMPORT_HMR_DIAGNOSTIC_PROFILE: '1' })).toBe(true)
  })

  it('captures write start and the full restored WXML at the existing observation boundary', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-import-hmr-diagnostic-'))
    const outputPath = path.join(root, 'index.wxml')
    const original = '<view><text>original</text></view>\n'
    let observed: Parameters<NonNullable<Parameters<typeof measureFileMarkerUpdate>[0]['onObserved']>>[0] | undefined
    try {
      await writeFile(outputPath, '<view>updated</view>\n')
      const elapsedMs = await measureFileMarkerUpdate({
        outputPath,
        marker: 'restore-marker',
        expectedOutput: original,
        update: async () => writeFile(outputPath, original),
        timeoutMs: 1_000,
        onObserved: (value) => { observed = value },
      })
      expect(observed).toMatchObject({ output: original, elapsedMs })
      expect(observed!.sourceWriteStartedAt).toBeLessThanOrEqual(observed!.wxmlObservedAt)
      expect(observed!.elapsedMs).toBe(elapsedMs)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('pins the remote diagnostic to one Ubuntu run and the requested exact sample set', async () => {
    const root = path.resolve(import.meta.dirname, '..')
    const workflow = parse(await (await import('node:fs/promises')).readFile(path.join(root, '.github/workflows/auto-import-hmr-diagnostic.yml'), 'utf8'))
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch'])
    expect(workflow.on.workflow_dispatch.inputs['candidate-sha']).toMatchObject({ required: true, type: 'string' })
    expect(workflow.jobs.diagnose['runs-on']).toBe('ubuntu-24.04')
    expect(workflow.jobs.diagnose.strategy).toBeUndefined()
    expect(workflow.permissions).toEqual({ contents: 'read' })
    const steps = workflow.jobs.diagnose.steps
    expect(steps.find((step: { name?: string }) => step.name === 'Check out the fixed baseline').with.ref).toBe('e7862e61dd83e3b9e356ac1e176267b31ab298af')
    expect(steps.find((step: { name?: string }) => step.name === 'Verify immutable checkout identities').run).toContain('EXPECTED_CANDIDATE_SHA !== process.env.CANDIDATE_SHA')
    const baseline = steps.find((step: { name?: string }) => step.name === 'Collect baseline manual restore timings')
    const control = steps.find((step: { name?: string }) => step.name === 'Collect candidate control outputs')
    const probe = steps.find((step: { name?: string }) => step.name === 'Collect candidate probe timings and profile')
    for (const step of [baseline, control, probe]) {
      expect(step.env).toMatchObject({
        AUTO_IMPORT_BENCH_PAIRED: '1',
        BENCH_ITERATIONS: '1',
        BENCH_SCENARIOS: '50,69',
        BENCH_CONFIGURATIONS: '["50:manual","69:manual"]',
      })
      expect(step.run).toContain('benchmark-auto-import-hmr.ts')
    }
    const configurations = JSON.parse(probe.env.BENCH_CONFIGURATIONS)
    expect(benchmarkModeSelected(50, 'manual', JSON.stringify(configurations))).toBe(true)
    expect(benchmarkModeSelected(69, 'manual', JSON.stringify(configurations))).toBe(true)
    expect(benchmarkModeSelected(50, 'automatic', JSON.stringify(configurations))).toBe(false)
    expect(benchmarkModeSelected(69, 'automatic', JSON.stringify(configurations))).toBe(false)
    expect(baseline.env.AUTO_IMPORT_HMR_DIAGNOSTIC).toBe('0')
    expect(control.env).toMatchObject({ AUTO_IMPORT_HMR_DIAGNOSTIC: '0', AUTO_IMPORT_HMR_DIAGNOSTIC_PROFILE: '0', AUTO_IMPORT_HMR_DIAGNOSTIC_PHASE: 'control' })
    expect(probe.env).toMatchObject({ AUTO_IMPORT_HMR_DIAGNOSTIC: '1', AUTO_IMPORT_HMR_DIAGNOSTIC_PROFILE: '1', AUTO_IMPORT_HMR_DIAGNOSTIC_PHASE: 'probe' })
    expect(steps.find((step: { name?: string }) => step.name === 'Verify deterministic output equivalence')).toBeDefined()
    expect(steps.findIndex((step: { name?: string }) => step.name === 'Collect candidate control outputs')).toBeLessThan(steps.findIndex((step: { name?: string }) => step.name === 'Collect candidate probe timings and profile'))
    expect(steps.find((step: { name?: string }) => step.name === 'Upload raw diagnostic reports').with.path).not.toContain('/fixtures')
    expect(steps.find((step: { name?: string }) => step.name === 'Summarize diagnostic measurements').run).toContain('not labeled as acknowledgement time')
  })
})
