import { describe, expect, it } from 'vitest'
import { createVerificationPlan, taskDefinitionHash } from './plan'

describe('verification plan acceptance source', () => {
  it('freezes a split task label with its actual DOM case source', async () => {
    const sourceCase = {
      file: 'e2e/ide/app-lifecycle.test.ts',
      name: 'app lifecycle compare (e2e) > compares wevu app lifecycle logs against native',
    }
    const task = {
      label: 'ide/app-lifecycle.native.test.ts',
      acceptanceSource: 'ide/app-lifecycle.test.ts',
      command: 'pnpm',
      args: ['vitest', 'run'],
    }
    const plan = await createVerificationPlan({
      suite: 'ide-full',
      shards: 1,
      profile: { os: 'darwin', nodeMajor: 26, provider: 'devtools', platform: 'weapp', runnerClass: 'local', arch: 'arm64' },
      tasks: [task],
      identity: { runId: 'run', commitSha: 'a'.repeat(40), workingTreeDirty: false },
      sourceDigest: 'b'.repeat(64),
      now: new Date('2026-11-17T00:00:00.000Z'),
      readCases: async () => [sourceCase],
    })

    expect(plan.tasks[0]).toMatchObject({
      label: task.label,
      acceptanceSource: task.acceptanceSource,
      cases: [sourceCase],
    })
    expect(taskDefinitionHash(task)).not.toBe(taskDefinitionHash({ ...task, acceptanceSource: 'ide/other.test.ts' }))
  })
})
