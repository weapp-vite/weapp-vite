import type { Metafile } from 'esbuild'
import type { RuntimeSizeReport, RuntimeSizeRetainedModules, RuntimeSizeTierReport } from './runtime-size'

import { describe, expect, it } from 'vitest'
import {
  assertRuntimeSizeReport,
  collectRuntimeSizeGuardViolations,
  createRuntimeSizeRetainedModules,
  normalizeRuntimeModulePath,
  resolveRuntimeImportChain,
  runtimeSizeBudgets,
  runtimeSizeTargets,
  runtimeSizeTiers,
} from './runtime-size'

function createReport(): RuntimeSizeReport {
  return {
    version: 4,
    generatedAt: '2026-09-04T00:00:00.000Z',
    commit: 'abc1234',
    targets: runtimeSizeTargets.map(target => ({
      id: target.id,
      label: target.label,
      tiers: runtimeSizeTiers.map((tier): RuntimeSizeTierReport => {
        const entry = `wevu-runtime-size-${target.id}-${tier.id}-production.mjs`
        const budget = runtimeSizeBudgets.find(candidate => (
          candidate.target === target.id && candidate.tier === tier.id
        ))
        return {
          id: tier.id,
          label: tier.label,
          dev: { bytes: 1 },
          production: {
            ...(target.gzip ? { gzipBytes: 1 } : {}),
            bytes: budget?.ceilingBytes ?? 1,
            retainedModules: {
              entry,
              modules: [{ path: entry, bytesInOutput: 1, imports: [] }],
            },
          },
        }
      }),
    })),
  }
}

function setRetainedModules(
  report: RuntimeSizeReport,
  tierId: RuntimeSizeTierReport['id'],
  retainedModules: RuntimeSizeRetainedModules,
) {
  const tier = report.targets.find(target => target.id === 'weapp')!.tiers.find(candidate => candidate.id === tierId)!
  tier.production.retainedModules = retainedModules
}

describe('runtime size budgets', () => {
  it('allows each configured ceiling and fails at one byte over', () => {
    expect(collectRuntimeSizeGuardViolations(createReport())).toEqual([])

    for (const budget of runtimeSizeBudgets) {
      const report = createReport()
      const target = report.targets.find(candidate => candidate.id === budget.target)!
      target.tiers.find(tier => tier.id === budget.tier)!.production.bytes = budget.ceilingBytes + 1
      expect(collectRuntimeSizeGuardViolations(report)).toEqual([
        {
          kind: 'budget',
          target: budget.target,
          tier: budget.tier,
          mode: budget.mode,
          actualBytes: budget.ceilingBytes + 1,
          ceilingBytes: budget.ceilingBytes,
        },
      ])
    }
  })
})

describe('runtime retained module graph', () => {
  it('normalizes repo-relative POSIX paths and ignores dead barrel shortcuts', () => {
    const entry = 'C:\\repo\\wevu-runtime-size-weapp-minimal-app-production.mjs'
    const deadBarrel = 'C:\\repo\\packages-runtime\\wevu\\dist\\runtime\\index.mjs'
    const liveImporter = 'C:\\repo\\packages-runtime\\wevu\\dist\\runtime\\register\\runtimeInstance.mjs'
    const deniedModule = 'C:\\repo\\packages-runtime\\wevu\\dist\\runtime\\scopedSlots.mjs'
    const metafile: Metafile = {
      inputs: {
        [entry]: {
          bytes: 100,
          imports: [
            { path: liveImporter, kind: 'import-statement' },
            { path: deadBarrel, kind: 'import-statement' },
          ],
          format: 'esm',
        },
        [deadBarrel]: {
          bytes: 20,
          imports: [{ path: deniedModule, kind: 'import-statement' }],
          format: 'esm',
        },
        [liveImporter]: {
          bytes: 200,
          imports: [{ path: deniedModule, kind: 'import-statement' }],
          format: 'esm',
        },
        [deniedModule]: { bytes: 400, imports: [], format: 'esm' },
      },
      outputs: {
        '<stdout>': {
          bytes: 371,
          inputs: {
            [entry]: { bytesInOutput: 0 },
            [deadBarrel]: { bytesInOutput: 0 },
            [liveImporter]: { bytesInOutput: 50 },
            [deniedModule]: { bytesInOutput: 321 },
          },
          imports: [],
          exports: [],
          entryPoint: entry,
        },
      },
    }

    const retainedModules = createRuntimeSizeRetainedModules('C:\\repo', metafile)

    expect(normalizeRuntimeModulePath('C:\\repo', deniedModule)).toBe('packages-runtime/wevu/dist/runtime/scopedSlots.mjs')
    expect(retainedModules).toEqual({
      entry: 'wevu-runtime-size-weapp-minimal-app-production.mjs',
      modules: [
        {
          path: 'packages-runtime/wevu/dist/runtime/index.mjs',
          bytesInOutput: 0,
          imports: ['packages-runtime/wevu/dist/runtime/scopedSlots.mjs'],
        },
        {
          path: 'packages-runtime/wevu/dist/runtime/register/runtimeInstance.mjs',
          bytesInOutput: 50,
          imports: ['packages-runtime/wevu/dist/runtime/scopedSlots.mjs'],
        },
        {
          path: 'packages-runtime/wevu/dist/runtime/scopedSlots.mjs',
          bytesInOutput: 321,
          imports: [],
        },
        {
          path: 'wevu-runtime-size-weapp-minimal-app-production.mjs',
          bytesInOutput: 0,
          imports: [
            'packages-runtime/wevu/dist/runtime/index.mjs',
            'packages-runtime/wevu/dist/runtime/register/runtimeInstance.mjs',
          ],
        },
      ],
    })
    expect(resolveRuntimeImportChain(
      retainedModules,
      'packages-runtime/wevu/dist/runtime/scopedSlots.mjs',
    )).toEqual([
      'wevu-runtime-size-weapp-minimal-app-production.mjs',
      'packages-runtime/wevu/dist/runtime/register/runtimeInstance.mjs',
      'packages-runtime/wevu/dist/runtime/scopedSlots.mjs',
    ])
  })

  it('applies explicit allow exceptions before stable suffix deny rules', () => {
    const report = createReport()
    const deniedPath = 'packages-runtime/wevu/dist/runtime/scopedSlots.mjs'
    setRetainedModules(report, 'minimal-app', {
      entry: 'wevu-runtime-size-weapp-minimal-app-production.mjs',
      modules: [
        {
          path: 'wevu-runtime-size-weapp-minimal-app-production.mjs',
          bytesInOutput: 0,
          imports: ['packages-runtime/wevu/dist/runtime/register/runtimeInstance.mjs'],
        },
        {
          path: 'packages-runtime/wevu/dist/runtime/register/runtimeInstance.mjs',
          bytesInOutput: 50,
          imports: [deniedPath],
        },
        { path: deniedPath, bytesInOutput: 321, imports: [] },
      ],
    })
    setRetainedModules(report, 'complex-component', {
      entry: 'wevu-runtime-size-weapp-complex-component-production.mjs',
      modules: [
        {
          path: 'wevu-runtime-size-weapp-complex-component-production.mjs',
          bytesInOutput: 1,
          imports: [deniedPath],
        },
        { path: deniedPath, bytesInOutput: 321, imports: [] },
      ],
    })

    expect(collectRuntimeSizeGuardViolations(report)).toEqual([
      {
        kind: 'retained-module',
        target: 'weapp',
        tier: 'minimal-app',
        mode: 'production',
        modulePath: deniedPath,
        bytesInOutput: 321,
        importChain: [
          'wevu-runtime-size-weapp-minimal-app-production.mjs',
          'packages-runtime/wevu/dist/runtime/register/runtimeInstance.mjs',
          deniedPath,
        ],
      },
    ])
  })

  it('ignores denylisted modules that contribute no bytes to the output', () => {
    const report = createReport()
    const deniedPath = 'packages-runtime/wevu/dist/runtime/scopedSlots.mjs'
    setRetainedModules(report, 'minimal-app', {
      entry: 'wevu-runtime-size-weapp-minimal-app-production.mjs',
      modules: [
        {
          path: 'wevu-runtime-size-weapp-minimal-app-production.mjs',
          bytesInOutput: 1,
          imports: [deniedPath],
        },
        { path: deniedPath, bytesInOutput: 0, imports: [] },
      ],
    })

    expect(collectRuntimeSizeGuardViolations(report)).toEqual([])
  })

  it('reports budget overflow and retained modules together', () => {
    const report = createReport()
    const minimal = report.targets[0]!.tiers.find(tier => tier.id === 'minimal-app')!
    const ceilingBytes = minimal.production.bytes
    minimal.production.bytes = ceilingBytes + 1
    minimal.production.retainedModules = {
      entry: 'wevu-runtime-size-weapp-minimal-app-production.mjs',
      modules: [
        {
          path: 'wevu-runtime-size-weapp-minimal-app-production.mjs',
          bytesInOutput: 0,
          imports: ['packages-runtime/wevu/dist/runtime/scopedSlots.mjs'],
        },
        {
          path: 'packages-runtime/wevu/dist/runtime/scopedSlots.mjs',
          bytesInOutput: 321,
          imports: [],
        },
      ],
    }

    expect(collectRuntimeSizeGuardViolations(report)).toEqual([
      {
        kind: 'budget',
        target: 'weapp',
        tier: 'minimal-app',
        mode: 'production',
        actualBytes: ceilingBytes + 1,
        ceilingBytes,
      },
      {
        kind: 'retained-module',
        target: 'weapp',
        tier: 'minimal-app',
        mode: 'production',
        modulePath: 'packages-runtime/wevu/dist/runtime/scopedSlots.mjs',
        bytesInOutput: 321,
        importChain: [
          'wevu-runtime-size-weapp-minimal-app-production.mjs',
          'packages-runtime/wevu/dist/runtime/scopedSlots.mjs',
        ],
      },
    ])
    expect(() => assertRuntimeSizeReport(report)).toThrow(Error)
  })
})
