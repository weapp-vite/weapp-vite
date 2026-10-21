import type { AcceptanceReport } from '../domAcceptanceReport/types'
import type { VerificationPlan } from '../verification/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { freeze, rehash } from '../../../scripts/verificationE2E/fixtures'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../domAcceptanceReport/helpers'
import { readHmrRuntimeReceipt } from './runtimeEvidence'

const directories: string[] = []

async function createEvidence(provider: 'devtools' | 'headless' = 'devtools') {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hmr-runtime-evidence-'))
  directories.push(directory)
  const base = await freeze({ shards: 1 })
  const plan: VerificationPlan = rehash({
    ...base,
    suite: provider === 'devtools' ? 'ide-hmr' : 'ide-hmr-headless',
    strict: true,
    profile: { ...base.profile, provider },
    tasks: base.tasks.slice(0, 2).map(task => ({
      ...task,
      label: `ide/${task.label}.test.ts`,
      cases: [{ file: `e2e/ide/${task.label}.test.ts`, name: `HMR ${task.label}` }],
    })),
  })
  const reports: AcceptanceReport[] = plan.tasks.map((task) => {
    const cases = [evaluateAcceptanceCase({
      ...task.cases![0]!,
      id: task.label,
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
    })]
    return {
      schemaVersion: 1,
      runId: plan.runId,
      commitSha: plan.commitSha,
      invocationId: task.label,
      taskLabel: task.label,
      template: null,
      provider,
      strict: true,
      environment: { nodeVersion: '24.15.0', ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.2' },
      startedAt: '2026-10-19T00:00:00.000Z',
      finishedAt: '2026-10-19T00:00:02.000Z',
      status: 'passed',
      errors: [],
      cases,
      summary: summarizeAcceptanceCases(cases),
    }
  })
  const files = reports.map((_, index) => path.join(directory, `${index}.json`))
  const save = () => Promise.all(reports.map((report, index) => fs.writeFile(files[index]!, JSON.stringify(report))))
  await save()
  return { plan, reports, files, save }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
})

describe('HMR runtime receipt from actual serialized evidence', () => {
  it.each(['devtools', 'headless'] as const)('counts completed same-commit %s cases and checkpoints independently', async (provider) => {
    const { plan, files } = await createEvidence(provider)
    await expect(readHmrRuntimeReceipt(plan, files)).resolves.toEqual({
      runId: plan.runId,
      commitSha: plan.commitSha,
      provider,
      tasks: plan.tasks.map(task => task.label).sort(),
      cases: 2,
      checkpoints: 2,
    })
  })

  it.each(['missing-task', 'duplicate', 'sha', 'run', 'provider', 'unplanned-task', 'missing-checkpoint', 'wrong-case', 'strict'])(
    'rejects %s evidence instead of inferring runtime success from task status',
    async (fault) => {
      const { plan, reports, files, save } = await createEvidence()
      const first = reports[0]!
      if (fault === 'missing-task') {
        files.pop()
        reports.pop()
      }
      if (fault === 'duplicate') {
        reports[1]!.invocationId = first.invocationId
      }
      if (fault === 'sha') {
        first.commitSha = 'c'.repeat(40)
      }
      if (fault === 'run') {
        first.runId = 'another-run'
      }
      if (fault === 'provider') {
        first.provider = 'headless'
        first.cases[0]!.acceptance!.provider = 'headless'
        first.cases[0]!.acceptance!.evidence[0]!.source = 'headless-logical-tree'
      }
      if (fault === 'unplanned-task') {
        first.taskLabel = 'ide/unplanned.test.ts'
      }
      if (fault === 'missing-checkpoint') {
        first.cases[0]!.acceptance!.evidence = []
      }
      if (fault === 'wrong-case') {
        first.cases[0]!.name = 'another case'
      }
      if (fault === 'strict') {
        plan.strict = false
      }
      await save()
      await expect(readHmrRuntimeReceipt(plan, files)).rejects.toThrow()
    },
  )
})
