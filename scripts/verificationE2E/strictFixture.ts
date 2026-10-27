import type { AcceptanceReport } from '../../e2e/scripts/domAcceptanceReport/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../e2e/scripts/domAcceptanceReport/helpers'
import { CLASSIC_IDE_CASES } from '../../e2e/scripts/hmrAcceptance/stableScopeCases'
import { freeze, profile, rehash, shardReports } from './fixtures'

const MIXED_LABEL = 'ide/issue-1015-css-hmr.runtime.test.ts'

export async function createStrictEvidenceFixture(provider: AcceptanceReport['provider'] = 'headless', mixed = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'verification-evidence-'))
  const plan = rehash({
    ...await freeze(),
    suite: mixed ? 'ide-hmr-headless:classic' : 'ide-full',
    strict: true,
    profile: { ...profile, provider },
    tasks: (await freeze()).tasks.map((task, index) => {
      const label = mixed && index === 0 ? MIXED_LABEL : task.label
      const name = mixed && index === 0 ? CLASSIC_IDE_CASES[MIXED_LABEL]!.find(item => item.supported)!.name : 'mounts'
      return { ...task, label, cases: [{ file: `e2e/${label}`, name }] }
    }),
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
        name: plan.tasks.find(planned => planned.label === task.label)!.cases![0]!.name,
        state: 'passed',
        startedAt: Date.parse('2026-10-19T00:00:00.000Z'),
        finishedAt: Date.parse('2026-10-19T00:00:02.000Z'),
        acceptance: {
          fixture: 'e2e-apps/example',
          provider,
          ...(provider === 'devtools' ? { runtime: { ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.4' } } : {}),
          checkpoints: [{ id: 'mounted', route: '/pages/index/index', action: 'mount', nodes: [{ selector: '.title', text: 'Ready' }] }],
          evidence: [{ id: 'mounted', route: 'pages/index/index', source: provider === 'headless' ? 'headless-logical-tree' : 'devtools-page-frame', capturedAt: checkpointTime, nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
        },
      })]
      const selectedCases = mixed && task.label === MIXED_LABEL ? plan.tasks.find(planned => planned.label === task.label)!.cases : undefined
      if (selectedCases) {
        cases.push(evaluateAcceptanceCase({
          id: `${task.label}-experimental`,
          file: `e2e/${task.label}`,
          name: CLASSIC_IDE_CASES[MIXED_LABEL]!.find(item => !item.supported)!.name,
          state: 'skipped',
        }))
      }
      const report: AcceptanceReport = {
        schemaVersion: 1,
        runId: plan.runId,
        commitSha: plan.commitSha,
        workingTreeDirty: false,
        invocationId: `invocation-${task.label}`,
        taskLabel: task.label,
        template: null,
        provider,
        strict: true,
        environment: { nodeVersion: 'v24.11.0', ideVersion: provider === 'devtools' ? '2.02.2608080' : null, baseLibraryVersion: provider === 'devtools' ? '3.17.4' : null },
        startedAt: '2026-10-19T00:00:00.000Z',
        finishedAt: '2026-10-19T00:00:02.000Z',
        status: 'passed',
        errors: [],
        cases,
        ...(selectedCases ? { selectedCases } : {}),
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
