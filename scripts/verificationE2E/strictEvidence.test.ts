import type { AcceptanceReport } from '../../e2e/scripts/domAcceptanceReport/types'
import fs from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../e2e/scripts/domAcceptanceReport/helpers'
import { freezeProviderCaseScope } from '../../e2e/scripts/domAcceptanceReport/taskCases'
import { aggregateVerificationReports } from '../../e2e/scripts/verification/aggregate'
import { now, rehash } from './fixtures'
import { createStrictEvidenceFixture } from './strictFixture'

const roots: string[] = []
const MIXED_LABEL = 'ide/issue-1015-css-hmr.runtime.test.ts'
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function setup(provider: AcceptanceReport['provider'] = 'headless', mixed = false) {
  const fixture = await createStrictEvidenceFixture(provider, mixed)
  roots.push(fixture.root)
  return fixture
}

describe('strict frozen shard aggregation', () => {
  it('revalidates the original case and checkpoint evidence after artifact download', async () => {
    const { plan, reports, files, root } = await setup()
    expect(await aggregateVerificationReports(plan, reports, { files, reportsRoot: root, now })).toMatchObject({ coverage: 'complete', acceptance: 'passed' })
  })

  it('restores mixed selection only from the canonical frozen cases after checking the task definition', async () => {
    const { plan, reports, files, root } = await setup('headless', true)
    expect(await aggregateVerificationReports(plan, reports, { files, reportsRoot: root, now })).toMatchObject({ coverage: 'complete', acceptance: 'passed' })
  })

  it.each(['missing-selection', 'changed-selection', 'executed-excluded', 'missing-case', 'missing-checkpoint', 'definition', 'case-hash'])(
    'rejects %s in a frozen mixed selection',
    async (fault) => {
      const { plan, reports, files, root, evidence } = await setup('headless', true)
      const index = evidence.findIndex(report => report.taskLabel === MIXED_LABEL)
      const report = evidence[index]!
      let frozen = plan
      if (fault === 'missing-selection') {
        delete report.selectedCases
      }
      if (fault === 'changed-selection') {
        report.selectedCases = [{ file: report.cases[1]!.file, name: report.cases[1]!.name }]
      }
      if (fault === 'executed-excluded') {
        report.cases[1] = { ...structuredClone(report.cases[0]!), id: report.cases[1]!.id, name: report.cases[1]!.name }
      }
      if (fault === 'missing-case') {
        report.cases.shift()
      }
      if (fault === 'missing-checkpoint') {
        report.cases[0]!.acceptance!.evidence = []
      }
      if (fault === 'definition') {
        reports.flatMap(shard => shard.tasks).find(task => task.label === MIXED_LABEL)!.definitionHash = 'c'.repeat(64)
      }
      if (fault === 'case-hash') {
        frozen = rehash({ ...plan, tasks: plan.tasks.map(task => task.label === MIXED_LABEL ? { ...task, cases: [{ file: report.cases[1]!.file, name: report.cases[1]!.name }] } : task) })
        for (const shard of reports) {
          shard.execution.planHash = frozen.planHash
        }
      }
      report.summary = summarizeAcceptanceCases(report.cases)
      await fs.writeFile(files[index]!, JSON.stringify(report))
      await expect(aggregateVerificationReports(frozen, reports, { files, reportsRoot: root, now })).rejects.toThrow()
    },
  )

  it('rejects a report that declares its own selected scope for an unregistered task', async () => {
    const { plan, reports, files, root, evidence } = await setup()
    const report = evidence[0]!
    report.selectedCases = [{ file: report.cases[0]!.file, name: report.cases[0]!.name }]
    report.cases.push(evaluateAcceptanceCase({ id: 'unapproved-scope', file: report.cases[0]!.file, name: 'unapproved case', state: 'skipped' }))
    report.summary = summarizeAcceptanceCases(report.cases)
    await fs.writeFile(files[0]!, JSON.stringify(report))
    await expect(aggregateVerificationReports(plan, reports, { files, reportsRoot: root, now })).rejects.toThrow('DOM case inventory mismatch')
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
