import assert from 'node:assert/strict'
import { aggregateVerificationReports } from '../../e2e/scripts/verification/aggregate.ts'
import { assertVerificationPlan } from '../../e2e/scripts/verification/plan.ts'
import { verificationPlanSchema } from '../../e2e/scripts/verification/validation.ts'
import { verificationResource } from './os.mjs'

export const taskSuiteScope = plan => plan.tasks.map(task => [task.label, task.definitionHash, task.outOfScopeReason ?? null]).sort(([left], [right]) => left.localeCompare(right))

/** 从基线原 job 的附加工件读取证据，不能把预期 plan 当作已完成执行。 */
export async function discoverBaselineTaskSuites(artifacts, read) {
  const groups = new Map()
  for (const artifact of artifacts) {
    const match = /^verification-suite-miniapp-e2e-ci-(pr|full)-(.+-node-\d+)(?:-shard-(\d+))?$/u.exec(artifact.name)
    if (match) {
      const [, mode, resource, index] = match
      const key = `${resource}-${mode}`
      groups.set(key, [...(groups.get(key) ?? []), { artifact: artifact.name, index: Number(index ?? 1), mode }])
    }
  }
  const evidence = []
  const gaps = []
  for (const [key, entries] of groups) {
    try {
      entries.sort((a, b) => a.index - b.index)
      const reference = (entry, file) => ({ artifact: entry.artifact, file })
      const first = entries[0]
      const planReference = reference(first, 'plan.json')
      const plan = verificationPlanSchema.parse(await read(planReference))
      assertVerificationPlan(plan)
      assert(!plan.strict && plan.suite === `ci-${first.mode}` && entries.length === plan.shardTotal, 'Baseline task-suite shards are incomplete')
      const shards = []
      let resource
      for (const [index, entry] of entries.entries()) {
        assert(entry.index === index + 1, 'Baseline task-suite shard indices are missing or duplicated')
        assert.deepEqual(await read(reference(entry, 'plan.json')), plan, 'Baseline shards used different shared frozen plans')
        const toolchain = await read(reference(entry, 'toolchain.json'))
        assert(toolchain.schemaVersion === 2 && toolchain.commit === plan.commitSha, 'Baseline toolchain checkout mismatch')
        const actual = verificationResource(toolchain, plan.profile)
        if (resource) {
          assert.deepEqual(actual, resource, 'Baseline shards used different actual toolchains')
        }
        resource = actual
        shards.push(await read(reference(entry, 'shard.json')))
      }
      const aggregate = await aggregateVerificationReports(plan, shards)
      if (plan.shardTotal === 1) {
        const actual = await read(reference(first, 'report.json'))
        for (const name of ['schemaVersion', 'toolVersion', 'runId', 'commitSha', 'workingTreeDirty', 'strict', 'coverage', 'acceptance', 'execution', 'tasks', 'summary']) {
          assert.deepEqual(actual[name], aggregate[name], `Baseline aggregate differs from verified shards: ${name}`)
        }
      }
      evidence.push({
        id: `task-suite-${key}`,
        kind: 'task-suite',
        scopeLevel: 'tasks',
        scope: taskSuiteScope(plan),
        plan: planReference,
        shards: entries.map(entry => reference(entry, 'shard.json')),
        ...(plan.shardTotal === 1 ? { aggregate: reference(first, 'report.json') } : { aggregateMode: 'verified-shards' }),
        toolchain: reference(first, 'toolchain.json'),
      })
    }
    catch (error) {
      gaps.push({ id: `task-suite-${key}`, reason: error.message })
    }
  }
  return { evidence, gaps }
}
