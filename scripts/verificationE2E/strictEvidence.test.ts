import type { AcceptanceReport } from '../../e2e/scripts/domAcceptanceReport/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../e2e/scripts/domAcceptanceReport/helpers'
import { aggregateVerificationReports } from '../../e2e/scripts/verification/aggregate'
import { freeze, now, profile, rehash, shardReports } from './fixtures'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'verification-evidence-'))
  roots.push(root)
  const plan = rehash({
    ...await freeze(),
    suite: 'ide-full',
    strict: true,
    profile: { ...profile, provider: 'headless' },
    tasks: (await freeze()).tasks.map(task => ({ ...task, cases: [{ file: `e2e/${task.label}`, name: 'mounts' }] })),
  })
  const reports = shardReports(plan)
  const files: string[] = []
  const evidence: AcceptanceReport[] = []
  for (const shard of reports) {
    for (const task of shard.tasks) {
      const checkpointTime = '2026-10-19T00:00:01.000Z'
      const cases = [evaluateAcceptanceCase({
        id: task.label,
        file: `e2e/${task.label}`,
        name: 'mounts',
        state: 'passed',
        startedAt: Date.parse('2026-10-19T00:00:00.000Z'),
        finishedAt: Date.parse('2026-10-19T00:00:02.000Z'),
        acceptance: {
          fixture: 'e2e-apps/example',
          provider: 'headless',
          checkpoints: [{ id: 'mounted', route: '/pages/index/index', action: 'mount', nodes: [{ selector: '.title', text: 'Ready' }] }],
          evidence: [{ id: 'mounted', route: 'pages/index/index', source: 'headless-logical-tree', capturedAt: checkpointTime, nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
        },
      })]
      const report: AcceptanceReport = {
        schemaVersion: 1,
        runId: plan.runId,
        commitSha: plan.commitSha,
        workingTreeDirty: false,
        invocationId: `invocation-${task.label}`,
        taskLabel: task.label,
        template: null,
        provider: 'headless',
        strict: true,
        environment: { nodeVersion: 'v24.11.0', ideVersion: null, baseLibraryVersion: null },
        startedAt: '2026-10-19T00:00:00.000Z',
        finishedAt: '2026-10-19T00:00:02.000Z',
        status: 'passed',
        errors: [],
        cases,
        summary: summarizeAcceptanceCases(cases),
      }
      const relative = `dom-acceptance/${plan.runId}/${task.label}.json`
      const file = path.join(root, relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, JSON.stringify(report))
      files.push(file)
      evidence.push(report)
      task.artifacts.push({ kind: 'dom-acceptance-report', indexPath: `docs/reports/${relative}` })
      shard.summary.artifactCount++
    }
  }
  return { root, plan, reports, files, evidence }
}

describe('strict frozen shard aggregation', () => {
  it('revalidates the original case and checkpoint evidence after artifact download', async () => {
    const { plan, reports, files, root } = await setup()
    expect(await aggregateVerificationReports(plan, reports, { files, reportsRoot: root, now })).toMatchObject({ coverage: 'complete', acceptance: 'passed' })
  })

  it.each(['checkpoint', 'case', 'duplicate-invocation', 'provider', 'missing-artifact', 'traversal'])(
    'rejects %s evidence',
    async (fault) => {
      const { plan, reports, files, root, evidence } = await setup()
      if (fault === 'checkpoint') {
        evidence[0]!.cases[0]!.acceptance!.evidence = []
      }
      if (fault === 'case') {
        evidence[0]!.cases[0]!.name = 'other case'
      }
      if (fault === 'duplicate-invocation') {
        evidence[1]!.invocationId = evidence[0]!.invocationId
      }
      if (fault === 'provider') {
        evidence[0]!.provider = 'devtools'
      }
      if (fault === 'missing-artifact') {
        await fs.rm(files[0]!)
      }
      if (fault === 'traversal') {
        reports[0]!.tasks[0]!.artifacts[0]!.indexPath = '../outside.json'
      }
      if (fault !== 'missing-artifact') {
        await Promise.all(evidence.map((report, index) => fs.writeFile(files[index]!, JSON.stringify(report))))
      }
      await expect(aggregateVerificationReports(plan, reports, { files: fault === 'missing-artifact' ? files.slice(1) : files, reportsRoot: root, now })).rejects.toThrow()
    },
  )
})
