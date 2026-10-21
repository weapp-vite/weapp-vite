import type { MachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import fs from 'node:fs/promises'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { tasks as fixtureTasks, identity, now, profile } from '../../scripts/verificationE2E/fixtures'
import { HMR_ACCEPTANCE_STAGES } from './hmr-acceptance-manifest'
import { createHmrAcceptanceSummary } from './hmrAcceptance/report'
import { readHmrRuntimeReceipt } from './hmrAcceptance/runtimeEvidence'
import { createHmrStageEvidence, createHmrUnitReceipt } from './hmrAcceptance/testFixtures'
import { runHmrUnitValidation } from './hmrAcceptance/unit'
import { runE2ESuiteCli } from './run-e2e-suite'
import { runHmrAcceptanceCli, selectHmrAcceptanceStages } from './run-hmr-acceptance'
import { aggregateVerificationReports } from './verification/aggregate'
import { createVerificationIdentity, createVerificationPlan, resolveVerificationTasks } from './verification/plan'

const tasks = fixtureTasks.map(task => ({ ...task, env: { ...task.env } }))

vi.mock('../../packages/devtools-runtime/src/lease/machine', () => ({
  withMachineE2ELease: vi.fn(async (work: () => Promise<unknown>) => await work()),
}))
vi.mock('./hmrAcceptance/unit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hmrAcceptance/unit')>()
  return { ...actual, runHmrUnitValidation: vi.fn() }
})
vi.mock('./hmrAcceptance/runtimeEvidence', () => ({ readHmrRuntimeReceipt: vi.fn() }))
vi.mock('./hmrAcceptance/report', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hmrAcceptance/report')>()
  return { ...actual, createHmrAcceptanceSummary: vi.fn(actual.createHmrAcceptanceSummary) }
})
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, default: { ...actual, mkdir: vi.fn(), writeFile: vi.fn() } }
})
vi.mock('./run-e2e-suite', () => ({ runE2ESuiteCli: vi.fn(async () => {}) }))
vi.mock('./verification/aggregate', () => ({ aggregateVerificationReports: vi.fn() }))
vi.mock('./verification/plan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./verification/plan')>()
  return { ...actual, createVerificationIdentity: vi.fn(), createVerificationPlan: vi.fn(), assertVerificationPlan: vi.fn(), resolveVerificationTasks: vi.fn(async () => tasks) }
})

function machineLease(environment: NodeJS.ProcessEnv = { TEST_MACHINE_LEASE: 'borrowed-ticket' }): MachineE2ELease {
  return {
    borrowed: false,
    released: false,
    environment,
    createChildScope: vi.fn<MachineE2ELease['createChildScope']>().mockRejectedValue(new Error('Unexpected child scope in acceptance runner unit test')),
    release: vi.fn(async () => {}),
  }
}

beforeEach(async () => {
  vi.resetAllMocks()
  vi.mocked(withMachineE2ELease).mockImplementation(async work => await work(machineLease()))
  vi.mocked(createVerificationIdentity).mockReturnValue(identity)
  vi.mocked(resolveVerificationTasks).mockResolvedValue(tasks)
  const actual = await vi.importActual<typeof import('./verification/plan')>('./verification/plan')
  vi.mocked(createVerificationPlan).mockImplementation(actual.createVerificationPlan)
  const report = await vi.importActual<typeof import('./hmrAcceptance/report')>('./hmrAcceptance/report')
  vi.mocked(createHmrAcceptanceSummary).mockImplementation(report.createHmrAcceptanceSummary)
  vi.mocked(runHmrUnitValidation).mockResolvedValue(createHmrUnitReceipt())
  for (const key of ['TASK_FILTER', 'TASK_FROM', 'TASK_ROLL_FROM', 'SHARD_INDEX', 'SHARD_TOTAL', 'TEMPLATE', 'ACCEPTANCE_CASES', 'COMPILER_HOST', 'CLASSIC_PROJECT', 'CLASSIC_MODE', 'STATEFUL_PROJECT']) {
    vi.stubEnv(`WEAPP_VITE_E2E_${key}`, undefined)
  }
})

async function prepareStages(onStage: (stage: string) => void = () => {}) {
  const evidence = await Promise.all(HMR_ACCEPTANCE_STAGES.map(createHmrStageEvidence))
  vi.mocked(createVerificationPlan).mockImplementation(async ({ suite }) => evidence.find(item => item.stage.suite === suite)!.plan)
  vi.mocked(runE2ESuiteCli).mockImplementation(async (args, callbacks) => {
    const current = evidence.find(item => item.stage.suite === args?.[0])!
    onStage(current.stage.name)
    callbacks?.onReport?.(current.report)
  })
  vi.mocked(aggregateVerificationReports).mockImplementation(async plan => evidence.find(item => item.plan.suite === plan.suite)!.report)
  vi.mocked(readHmrRuntimeReceipt).mockImplementation(async (plan) => {
    onStage(`${plan.profile.provider}-receipt`)
    return evidence.find(item => item.plan.suite === plan.suite)!.runtime!
  })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('independent HMR acceptance entry', () => {
  it('rejects filters and failure suppression before acquiring resources', () => {
    for (const arg of ['--allow-failures', '--filter=native', '--from=2', '--shard-index=1']) {
      expect(() => selectHmrAcceptanceStages('all', [arg], {})).toThrow('ad-hoc')
    }
    expect(() => selectHmrAcceptanceStages('all', [], { WEAPP_VITE_E2E_TASK_FILTER: 'native' })).toThrow('ad-hoc')
    expect(() => selectHmrAcceptanceStages('all', [], { WEAPP_VITE_E2E_STATEFUL_PROJECT: 'external-fixture' })).toThrow('ad-hoc')
    expect(() => selectHmrAcceptanceStages('missing', [], {})).toThrow('Unknown')
  })

  it('rejects a stateful fixture override before reserving output or acquiring resources', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_STATEFUL_PROJECT', 'external-fixture')
    await expect(runHmrAcceptanceCli(['all'])).rejects.toThrow('ad-hoc')
    expect(fs.mkdir).not.toHaveBeenCalled()
    expect(withMachineE2ELease).not.toHaveBeenCalled()
    expect(runHmrUnitValidation).not.toHaveBeenCalled()
    expect(runE2ESuiteCli).not.toHaveBeenCalled()
  })

  it('reserves a fresh output directory exclusively before running validation', async () => {
    await prepareStages()
    await runHmrAcceptanceCli(['all'])
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, expect.any(String), { recursive: true })
    expect(fs.mkdir).toHaveBeenNthCalledWith(2, expect.any(String), { recursive: false })
    expect(vi.mocked(fs.mkdir).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(withMachineE2ELease).mock.invocationCallOrder[0]!)
  })

  it('rejects a reused run ID without overwriting its previous success or failure evidence', async () => {
    vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined).mockRejectedValueOnce(Object.assign(new Error('Directory exists'), { code: 'EEXIST' }))
    await expect(runHmrAcceptanceCli(['all'])).rejects.toThrow('output directory already exists')
    expect(fs.writeFile).not.toHaveBeenCalled()
    expect(resolveVerificationTasks).not.toHaveBeenCalled()
    expect(withMachineE2ELease).not.toHaveBeenCalled()
    expect(runHmrUnitValidation).not.toHaveBeenCalled()
    expect(runE2ESuiteCli).not.toHaveBeenCalled()
  })

  it('fails a zero-exit stage that never emitted its planned report and restores the inherited provider', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    vi.mocked(createVerificationIdentity).mockReturnValue(identity)
    const actual = await vi.importActual<typeof import('./verification/plan')>('./verification/plan')
    vi.mocked(createVerificationPlan).mockResolvedValue(await actual.createVerificationPlan({ suite: 'hmr-build', shards: 1, profile, tasks, identity, sourceDigest: 'b'.repeat(64), now }))
    await expect(runHmrAcceptanceCli(['build'])).rejects.toThrow('did not produce a verification report')
    expect(runE2ESuiteCli).toHaveBeenCalledOnce()
    expect(runHmrUnitValidation).not.toHaveBeenCalled()
    expect(aggregateVerificationReports).not.toHaveBeenCalled()
    expect(process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER).toBe('headless')
  })

  it('rejects a dirty checkout before running any stage', async () => {
    vi.mocked(createVerificationIdentity).mockReturnValue({ ...identity, workingTreeDirty: true })
    await expect(runHmrAcceptanceCli(['all'])).rejects.toThrow('clean committed checkout')
    expect(runE2ESuiteCli).not.toHaveBeenCalled()
    expect(runHmrUnitValidation).not.toHaveBeenCalled()
  })

  it.each(['build', 'headless', 'ide'] as const)('rejects excluded required %s tasks before acquiring resources or starting units', async (name) => {
    const stage = HMR_ACCEPTANCE_STAGES.find(stage => stage.name === name)!
    vi.mocked(resolveVerificationTasks).mockImplementation(async suite => suite === stage.suite
      ? tasks.map((task, index) => index === 0 ? { ...task, outOfScopeReason: 'Excluded by WEAPP_VITE_E2E_EXCLUDE_PROJECTS' } : task)
      : tasks)
    await expect(runHmrAcceptanceCli(['all'])).rejects.toThrow('cannot exclude required manifest tasks')
    expect(withMachineE2ELease).not.toHaveBeenCalled()
    expect(createVerificationPlan).not.toHaveBeenCalled()
    expect(runHmrUnitValidation).not.toHaveBeenCalled()
    expect(runE2ESuiteCli).not.toHaveBeenCalled()
  })

  it('runs units before every E2E layer under one lease and publishes full results only after cleanup', async () => {
    const events: string[] = []
    await prepareStages(stage => events.push(stage))
    vi.mocked(runHmrUnitValidation).mockImplementation(async () => {
      events.push('unit')
      return createHmrUnitReceipt()
    })
    vi.mocked(withMachineE2ELease).mockImplementation(async (work) => {
      events.push('lease-acquired')
      const result = await work(machineLease())
      events.push('cleanup')
      return result
    })
    vi.mocked(fs.writeFile).mockImplementation(async (file) => {
      if (String(file).endsWith('index.json')) {
        events.push('summary')
      }
    })
    const summary = await runHmrAcceptanceCli(['all'])
    expect(events).toEqual(['lease-acquired', 'unit', 'build', 'headless', 'headless-receipt', 'ide', 'devtools-receipt', 'cleanup', 'summary'])
    expect(readHmrRuntimeReceipt).toHaveBeenCalledTimes(2)
    expect(vi.mocked(aggregateVerificationReports).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(readHmrRuntimeReceipt).mock.invocationCallOrder[0]!)
    expect(runHmrUnitValidation).toHaveBeenCalledWith(expect.objectContaining({ identity, environment: { TEST_MACHINE_LEASE: 'borrowed-ticket' } }))
    expect(summary).toMatchObject({ scope: 'full', unit: { status: 'passed', commitSha: identity.commitSha } })
  })

  it('stops before E2E when unit execution fails and retains a failure receipt instead of a full index', async () => {
    vi.mocked(runHmrUnitValidation).mockRejectedValue(new Error('unit child failed'))
    await expect(runHmrAcceptanceCli(['all'])).rejects.toThrow('unit child failed')
    expect(runE2ESuiteCli).not.toHaveBeenCalled()
    const files = vi.mocked(fs.writeFile).mock.calls.map(([file]) => String(file))
    expect(files.some(file => file.endsWith('failure.json'))).toBe(true)
    expect(files.some(file => file.endsWith('index.json'))).toBe(false)
  })

  it('does not publish full success when lease cleanup fails after every validation passed', async () => {
    await prepareStages()
    vi.mocked(withMachineE2ELease).mockImplementation(async (work) => {
      await work(machineLease({}))
      throw new Error('lease cleanup failed')
    })
    await expect(runHmrAcceptanceCli(['all'])).rejects.toThrow('lease cleanup failed')
    expect(runE2ESuiteCli).toHaveBeenCalledTimes(3)
    expect(vi.mocked(fs.writeFile).mock.calls.some(([file]) => String(file).endsWith('index.json'))).toBe(false)
  })

  it('preserves an incomplete index but rejects the full command when required capability evidence is missing', async () => {
    await prepareStages()
    const actual = await vi.importActual<typeof import('./hmrAcceptance/report')>('./hmrAcceptance/report')
    vi.mocked(createHmrAcceptanceSummary).mockImplementation((...args) => ({
      ...actual.createHmrAcceptanceSummary(...args),
      coverage: 'partial',
      acceptance: 'incomplete',
      capabilityAcceptance: {
        ...actual.createHmrAcceptanceSummary(...args).capabilityAcceptance,
        status: 'incomplete',
        missingRequiredCoverage: ['future-capability'],
      },
    }))
    await expect(runHmrAcceptanceCli(['all'])).rejects.toThrow('future-capability')
    const files = vi.mocked(fs.writeFile).mock.calls.map(([file]) => String(file))
    expect(files.some(file => file.endsWith('index.json'))).toBe(true)
    expect(files.some(file => file.endsWith('failure.json'))).toBe(true)
  })
})
