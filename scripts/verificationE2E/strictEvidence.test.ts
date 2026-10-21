import type { AcceptanceReport } from '../../e2e/scripts/domAcceptanceReport/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../e2e/scripts/domAcceptanceReport/helpers'
import { freezeProviderCaseScope } from '../../e2e/scripts/domAcceptanceReport/taskCases'
import { aggregateVerificationReports } from '../../e2e/scripts/verification/aggregate'
import { freeze, now, profile, rehash, shardReports } from './fixtures'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function setup(provider: AcceptanceReport['provider'] = 'headless') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'verification-evidence-'))
  roots.push(root)
  const plan = rehash({
    ...await freeze(),
    suite: 'ide-full',
    strict: true,
    profile: { ...profile, provider },
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
          provider,
          ...(provider === 'devtools' ? { runtime: { ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.4' } } : {}),
          checkpoints: [{ id: 'mounted', route: '/pages/index/index', action: 'mount', nodes: [{ selector: '.title', text: 'Ready' }] }],
          evidence: [{ id: 'mounted', route: 'pages/index/index', source: provider === 'headless' ? 'headless-logical-tree' : 'devtools-page-frame', capturedAt: checkpointTime, nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
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
        provider,
        strict: true,
        environment: { nodeVersion: 'v24.11.0', ideVersion: provider === 'devtools' ? '2.02.2608080' : null, baseLibraryVersion: provider === 'devtools' ? '3.17.4' : null },
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

  it('rejects a frozen case skipped without a DOM plan even when its task report otherwise passed', async () => {
    const { plan, reports, files, root, evidence } = await setup()
    const report = evidence[0]!
    const skipped = evaluateAcceptanceCase({ id: 'skipped-boundary', file: `e2e/${report.taskLabel}`, name: 'checks the boundary', state: 'skipped' })
    const frozen = rehash({
      ...plan,
      tasks: plan.tasks.map(task => task.label === report.taskLabel
        ? { ...task, cases: [...task.cases!, { file: skipped.file, name: skipped.name }] }
        : task),
    })
    for (const shard of reports) {
      shard.execution.planHash = frozen.planHash
    }
    report.cases.push(skipped)
    report.summary = summarizeAcceptanceCases(report.cases)
    expect(report).toMatchObject({ status: 'passed', summary: { plannedCount: 1, passedCount: 1, skippedCount: 1 } })
    await fs.writeFile(files[0]!, JSON.stringify(report))
    await expect(aggregateVerificationReports(frozen, reports, { files, reportsRoot: root, now })).rejects.toThrow('Planned DOM case did not pass with acceptance evidence')
  })

  it('lists a statically frozen headless-only case outside DevTools scope without counting it as passed', async () => {
    const { plan, reports, files, root, evidence } = await setup('devtools')
    const report = evidence[0]!
    const skipped = evaluateAcceptanceCase({ id: 'headless-only', file: `e2e/${report.taskLabel}`, name: 'headless lifecycle', state: 'skipped' })
    const providerScope = freezeProviderCaseScope({ providers: ['headless'], conditions: [{ modifier: 'runIf', expression: 'provider === \'headless\'', source: 'e2e/ide/example.test.ts:1' }] }, 'devtools')
    const frozen = rehash({
      ...plan,
      tasks: plan.tasks.map(task => task.label === report.taskLabel
        ? { ...task, cases: [...task.cases!, { file: skipped.file, name: skipped.name, providerScope }] }
        : task),
    })
    for (const shard of reports) {
      shard.execution.planHash = frozen.planHash
    }
    report.cases.push(skipped)
    report.summary = summarizeAcceptanceCases(report.cases)
    await fs.writeFile(files[0]!, JSON.stringify(report))
    const scopedReports = reports.map(shard => ({
      ...shard,
      summary: { ...shard.summary, providerOutOfScopeCaseCount: shard.tasks.some(task => task.label === report.taskLabel) ? 1 : 0 },
      tasks: shard.tasks.map(task => ({ ...task, providerOutOfScopeCases: task.label === report.taskLabel ? [{ file: skipped.file, name: skipped.name, providerScope: structuredClone(providerScope) }] : [] })),
    }))
    const aggregate = await aggregateVerificationReports(frozen, scopedReports, { files, reportsRoot: root, now })
    expect(aggregate).toMatchObject({ coverage: 'complete', acceptance: 'passed', summary: { providerOutOfScopeCaseCount: 1, passedCount: 4 } })
    expect(aggregate.tasks.find(task => task.label === report.taskLabel)?.providerOutOfScopeCases).toEqual([{ file: skipped.file, name: skipped.name, providerScope }])
    expect(report.summary).toMatchObject({ passedCount: 1, skippedCount: 1 })
    const containing = scopedReports.find(shard => shard.tasks.some(task => task.label === report.taskLabel))!
    containing.tasks.find(task => task.label === report.taskLabel)!.providerOutOfScopeCases[0]!.providerScope.reason = 'unproven exclusion'
    await expect(aggregateVerificationReports(frozen, scopedReports, { files, reportsRoot: root, now })).rejects.toThrow('scope records do not match')
  })

  it('still rejects a skipped headless-only case on the headless provider', async () => {
    const { plan, reports, files, root, evidence } = await setup()
    const report = evidence[0]!
    const skipped = evaluateAcceptanceCase({ id: 'headless-only', file: `e2e/${report.taskLabel}`, name: 'headless lifecycle', state: 'skipped' })
    const providerScope = freezeProviderCaseScope({ providers: ['headless'], conditions: [{ modifier: 'runIf', expression: 'provider === \'headless\'', source: 'e2e/ide/example.test.ts:1' }] }, 'headless')
    const frozen = rehash({
      ...plan,
      tasks: plan.tasks.map(task => task.label === report.taskLabel
        ? { ...task, cases: [...task.cases!, { file: skipped.file, name: skipped.name, providerScope }] }
        : task),
    })
    for (const shard of reports) {
      shard.execution.planHash = frozen.planHash
    }
    report.cases.push(skipped)
    report.summary = summarizeAcceptanceCases(report.cases)
    await fs.writeFile(files[0]!, JSON.stringify(report))
    await expect(aggregateVerificationReports(frozen, reports, { files, reportsRoot: root, now })).rejects.toThrow('Planned DOM case did not pass with acceptance evidence')
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
