/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动真实消费者 Vitest。 */
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { sanitizeBuildCommandEnv } from '../utils/buildLog'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const FIXTURE_CONFIG = path.join(
  REPO_ROOT,
  'test/fixture-projects/wevu-test-utils-consumer/vitest.config.ts',
)

describe('@wevu/test-utils consumer e2e', () => {
  it('compiles and mounts an SFC through built public package exports', async () => {
    const result = await execa('pnpm', [
      'vitest',
      'run',
      '-c',
      FIXTURE_CONFIG,
    ], {
      cwd: REPO_ROOT,
      extendEnv: false,
      env: sanitizeBuildCommandEnv(),
      reject: false,
      timeout: 60_000,
    })

    expect(result.exitCode, result.stderr || result.stdout).toBe(0)
    expect(result.stdout).toContain('1 passed')
  })
})
