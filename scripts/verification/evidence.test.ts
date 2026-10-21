import type { VerificationTask } from './types.ts'
import { createRequire } from 'node:module'
import process from 'node:process'
import { expect, it } from 'vitest'
import { createTurboFixture } from '../turboCacheContract/fixture.ts'
import { readTurboEvidence } from './evidence.ts'
import { createTaskExecutor } from './run.ts'

it('records actual execution and cache hits using summaries from its own Turbo child', async () => {
  const fixture = await createTurboFixture()
  try {
    const task: VerificationTask = {
      id: 'build',
      kind: 'build',
      command: process.execPath,
      args: [createRequire(import.meta.url).resolve('turbo/bin/turbo'), 'run', 'build', '--filter=@cache-fixture/library', '--cache=local:rw', '--summarize'],
      directory: '.',
      dependencies: [],
      reason: 'fixture',
      evidence: 'turbo-summary',
      env: { TURBO_TELEMETRY_DISABLED: '1', TURBO_TOKEN: '', TURBO_TEAM: '' },
    }
    const execute = createTaskExecutor(fixture.root, true)
    const actual = await execute(task)
    const cached = await execute(task)
    expect(actual).toMatchObject({ exitCode: 0, execution: 'actual', subtasks: [{ id: '@cache-fixture/library#build', execution: 'actual', exitCode: 0 }] })
    expect(cached).toMatchObject({ exitCode: 0, execution: 'cached', subtasks: [{ id: '@cache-fixture/library#build', execution: 'cached' }] })
    expect(await fixture.read('packages/library/.runs/build')).toBe('run\n')
    await expect(readTurboEvidence(fixture.root, 'Tasks: 1 successful')).rejects.toThrow('summary')
    await expect(readTurboEvidence(fixture.root, 'Summary: /unrelated/.turbo/runs/run.json')).rejects.toThrow('当前仓库')
  }
  finally {
    await fixture.cleanup()
  }
}, 30_000)
