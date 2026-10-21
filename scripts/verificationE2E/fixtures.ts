import type { SuiteTask } from '../../e2e/scripts/suiteRunner'
import type { VerificationPlan, VerificationProfile } from '../../e2e/scripts/verification/types'
import { createVerificationPlan, verificationHash } from '../../e2e/scripts/verification/plan'

export const profile: VerificationProfile = { os: 'linux', nodeMajor: 24, provider: 'none', platform: 'weapp', runnerClass: 'github-hosted', arch: 'x64' }
export const identity = { runId: 'verification-run', commitSha: 'a'.repeat(40), workingTreeDirty: false }
export const now = new Date('2026-10-19T00:10:00.000Z')
export const tasks: SuiteTask[] = ['a', 'b', 'c', 'd'].map(label => ({ label, command: 'node', args: ['check.ts', label] }))

export function freeze(overrides: Partial<Parameters<typeof createVerificationPlan>[0]> = {}) {
  return createVerificationPlan({ suite: 'ci-full', shards: 2, profile, tasks, identity, sourceDigest: 'b'.repeat(64), now, ...overrides })
}

export function rehash(plan: VerificationPlan): VerificationPlan {
  const { planHash: _hash, ...content } = plan
  return { ...content, planHash: verificationHash(content) }
}

export function shardReports(plan: VerificationPlan) {
  return Array.from({ length: plan.shardTotal }, (_, index) => {
    const assigned = plan.tasks.filter(task => task.shardIndex === index + 1)
    return {
      schemaVersion: 2,
      toolVersion: 1,
      runId: plan.runId,
      commitSha: plan.commitSha,
      workingTreeDirty: false,
      strict: plan.strict,
      coverage: 'partial',
      acceptance: 'incomplete',
      execution: {
        scope: 'shard',
        status: 'passed',
        profile: plan.profile,
        executionTopology: plan.executionTopology,
        planHash: plan.planHash,
        shardIndex: index + 1,
        shardTotal: plan.shardTotal,
        assignedTasks: assigned.map(task => task.label),
        startedAt: '2026-10-19T00:00:00.000Z',
        finishedAt: '2026-10-19T00:01:00.000Z',
      },
      tasks: assigned.map(task => ({ label: task.label, definitionHash: task.definitionHash, durationMs: task.estimatedDurationMs, status: 'passed', exitCode: 0, artifacts: [] as Array<{ kind: 'dom-acceptance-report', indexPath: string }> })),
      summary: {
        taskCount: assigned.length,
        plannedCount: assigned.length,
        executedCount: assigned.length,
        passedCount: assigned.length,
        failedCount: 0,
        blockedCount: 0,
        skippedCount: 0,
        notExecutedCount: 0,
        outOfScopeCount: 0,
        artifactCount: 0,
      },
    }
  })
}

export const receipt = {
  repository: 'example/project',
  workflow: 'ci-e2e.yml',
  runId: 1,
  runAttempt: 1,
  headSha: identity.commitSha,
  headBranch: 'main',
  defaultBranch: 'main',
  event: 'push',
  conclusion: 'success',
  verified: true,
}
