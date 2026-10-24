import type { AcceptanceReport } from '../domAcceptanceReport/types'
import type { VerificationPlan } from '../verification/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { isolateTopologyTestEnvironment, useIsolatedTopologyTestEnvironment } from '../../../scripts/verification/topologyTestFixture.ts'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../domAcceptanceReport/helpers'
import { HMR_CLASSIC_ACCEPTANCE_STAGES } from '../hmr-acceptance-manifest'
import { readHmrRuntimeReceipt } from './runtimeEvidence'
import { CLASSIC_IDE_CASES } from './stableScopeCases'
import { createHmrStageEvidenceSet } from './testFixtures'

useIsolatedTopologyTestEnvironment()

const directories: string[] = []
let plans: VerificationPlan[]

beforeAll(async () => {
  const restore = isolateTopologyTestEnvironment()
  try {
    plans = (await createHmrStageEvidenceSet(HMR_CLASSIC_ACCEPTANCE_STAGES)).filter(stage => stage.stage.provider !== 'none').map(stage => stage.plan)
  }
  finally {
    restore()
  }
})

async function createEvidence(provider: 'devtools' | 'headless') {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-hmr-evidence-'))
  directories.push(directory)
  const plan = structuredClone(plans.find(plan => plan.profile.provider === provider)!)
  const reports: AcceptanceReport[] = plan.tasks.filter(task => !task.outOfScopeReason).map((task) => {
    const cases = task.cases!.map((item, index) => {
      if (item.providerScope?.scope === 'out-of-scope') {
        return evaluateAcceptanceCase({ ...item, id: `${task.label}-${index}`, state: 'skipped' })
      }
      return evaluateAcceptanceCase({
        ...item,
        id: `${task.label}-${index}`,
        state: 'passed',
        startedAt: Date.parse('2026-10-19T00:00:00.000Z'),
        finishedAt: Date.parse('2026-10-19T00:00:02.000Z'),
        acceptance: {
          fixture: 'e2e-apps/stateful-hmr',
          provider,
          runtime: { ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.2' },
          checkpoints: [{ id: 'updated', route: '/pages/native/index', action: 'save source', nodes: [{ selector: '.marker', text: 'updated' }] }],
          evidence: [{ id: 'updated', route: 'pages/native/index', source: provider === 'devtools' ? 'devtools-page-frame' : 'headless-logical-tree', capturedAt: '2026-10-19T00:00:01.000Z', nodes: [{ selector: '.marker', query: 'css', count: 1, nodes: [{ text: 'updated' }] }] }],
        },
      })
    })
    const mixed = CLASSIC_IDE_CASES[task.label]
    cases.push(...(mixed ?? []).filter(item => !item.supported).map((item, index) => evaluateAcceptanceCase({
      file: `e2e/${task.label}`,
      name: item.name,
      id: `${task.label}-excluded-${index}`,
      state: 'skipped',
    })))
    return {
      schemaVersion: 1,
      runId: plan.runId,
      commitSha: plan.commitSha,
      invocationId: task.label,
      taskLabel: task.label,
      template: null,
      provider,
      strict: true,
      ...(mixed ? { selectedCases: task.cases } : {}),
      environment: { nodeVersion: '24.15.0', ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.2' },
      startedAt: '2026-10-19T00:00:00.000Z',
      finishedAt: '2026-10-19T00:00:02.000Z',
      status: 'passed',
      errors: [],
      cases,
      summary: summarizeAcceptanceCases(cases),
    }
  })
  const save = async () => Promise.all(reports.map(async (report, index) => {
    const file = path.join(directory, `${index}.json`)
    await fs.writeFile(file, JSON.stringify(report))
    return file
  }))
  return { plan, reports, save }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
})

describe('classic HMR receipts retain exact runtime boundaries', () => {
  it.each(['headless', 'devtools'] as const)('accepts every supported %s case without counting unselected experiments', async (provider) => {
    const { plan, save } = await createEvidence(provider)
    const receipt = await readHmrRuntimeReceipt(plan, await save())
    const supported = plan.tasks.filter(task => !task.outOfScopeReason)
    expect(receipt.tasks).toEqual(supported.map(task => task.label).sort())
    expect(receipt.cases).toBe(supported.flatMap(task => task.cases ?? []).filter(item => item.providerScope?.scope !== 'out-of-scope').length)
    expect(receipt.checkpoints).toBe(receipt.cases)
  })

  it.each(['missing-task', 'missing-case', 'unexpected-passed', 'selected-mismatch', 'out-of-scope-report'])(
    'rejects %s from serialized evidence',
    async (fault) => {
      const { plan, reports, save } = await createEvidence('devtools')
      const mixed = reports.find(report => report.selectedCases)!
      if (fault === 'missing-task') {
        reports.pop()
      }
      if (fault === 'missing-case') {
        mixed.cases.shift()
      }
      if (fault === 'unexpected-passed') {
        const unexpected = mixed.cases.find(item => item.state === 'skipped')!
        Object.assign(unexpected, structuredClone(mixed.cases[0]), { id: unexpected.id, name: unexpected.name })
      }
      if (fault === 'selected-mismatch') {
        mixed.selectedCases = []
      }
      if (fault === 'out-of-scope-report') {
        reports[0]!.taskLabel = plan.tasks.find(task => task.outOfScopeReason)!.label
      }
      for (const report of reports) {
        report.summary = summarizeAcceptanceCases(report.cases)
      }
      await expect(readHmrRuntimeReceipt(plan, await save())).rejects.toThrow()
    },
  )
})
