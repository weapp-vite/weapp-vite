import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSuiteReport } from '../../e2e/scripts/suiteReport'
import { assertVerificationPlan } from '../../e2e/scripts/verification/plan'
import { verificationPlanSchema } from '../../e2e/scripts/verification/validation'
import { freeze, identity, now, profile, rehash } from './fixtures'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function queryPlan(provider: 'devtools' | 'headless') {
  return freeze({
    suite: 'ide-full',
    shards: 1,
    profile: { ...profile, provider },
    tasks: [{ label: 'ide/wevu-query.runtime.test.ts', command: 'node', args: [] }],
  })
}

describe('frozen provider case applicability', () => {
  it('keeps the headless-only declaration in the DevTools plan with an explicit reason and source', async () => {
    const plan = await queryPlan('devtools')
    expect(plan.tasks[0]!.cases).toHaveLength(3)
    expect(plan.tasks[0]!.cases![2]).toMatchObject({
      name: expect.stringContaining('defers automatic queries'),
      providerScope: {
        providers: ['headless'],
        provider: 'devtools',
        scope: 'out-of-scope',
        reason: expect.stringContaining('Provider devtools is outside declared applicability (headless)'),
        conditions: [{ modifier: 'runIf', expression: 'runtimeProvider === \'headless\'', source: expect.stringMatching(/^e2e\/ide\/wevu-query\.runtime\.test\.ts:\d+$/) }],
      },
    })
    expect(verificationPlanSchema.parse(plan)).toEqual(plan)
    expect(() => assertVerificationPlan(plan)).not.toThrow()
  })

  it('requires the same declaration in headless and rejects inconsistent or entirely excluded scopes', async () => {
    const plan = await queryPlan('headless')
    const cases = plan.tasks[0]!.cases!
    expect(cases[2]?.providerScope).toMatchObject({ provider: 'headless', scope: 'in-scope', providers: ['headless'] })
    const outside = (await queryPlan('devtools')).tasks[0]!.cases![2]!
    expect(() => assertVerificationPlan(rehash({ ...plan, tasks: [{ ...plan.tasks[0]!, cases: [outside] }] }))).toThrow('modified')
    const devtools = await queryPlan('devtools')
    expect(() => assertVerificationPlan(rehash({ ...devtools, tasks: [{ ...devtools.tasks[0]!, cases: [outside] }] }))).toThrow('modified')
    expect(() => assertVerificationPlan(rehash({ ...devtools, tasks: [{ ...devtools.tasks[0]!, cases: [...devtools.tasks[0]!.cases!.slice(0, 2), { ...outside, providerScope: { ...outside.providerScope!, scope: 'in-scope' } }] }] }))).toThrow('modified')
  })

  it('writes the provider exclusion count and reason separately in suite JSON and Markdown', async () => {
    const plan = await queryPlan('devtools')
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'provider-case-report-'))
    roots.push(root)
    const task = plan.tasks[0]!
    const payload = createSuiteReport([{ label: task.label, status: 'passed', durationMs: 1, exitCode: 0, artifacts: [] }], 'provider-cases', now, root, {
      ...identity,
      strict: true,
      partial: false,
      plannedTasks: [{ label: task.label }],
      plannedCases: { [task.label]: task.cases! },
    })
    expect(payload.summary).toMatchObject({ taskCount: 1, passedCount: 1, providerOutOfScopeCaseCount: 1 })
    expect(payload.tasks[0]?.providerOutOfScopeCases).toEqual([task.cases![2]])
    const markdown = await fs.readFile(path.join(payload.reportDir, payload.markdownFile), 'utf8')
    expect(markdown).toContain('Provider 不适用 case：`1`（单列，不计为通过）')
    expect(markdown).toContain(`[provider-out-of-scope] ${task.cases![2]!.name}`)
    const json = JSON.parse(await fs.readFile(path.join(payload.reportDir, payload.jsonFile), 'utf8')) as typeof payload
    expect(json.summary.providerOutOfScopeCaseCount).toBe(1)
  })
})
