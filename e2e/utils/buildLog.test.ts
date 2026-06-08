import { describe, expect, it } from 'vitest'
import { sanitizeBuildCommandEnv } from './buildLog'

describe('buildLog', () => {
  it('strips parent pnpm script package metadata before spawning project builds', () => {
    const env = sanitizeBuildCommandEnv({
      FOO: 'bar',
      NODE_ENV: 'test',
      PNPM_PACKAGE_NAME: 'weapp-vite-monorepo',
      PNPM_SCRIPT_SRC_DIR: '/repo',
      VITEST: 'true',
      VITEST_MODE: 'run',
      VITEST_POOL_ID: 'pool-1',
      VITEST_WORKER_ID: 'worker-1',
      WEAPP_VITE_E2E_TARGET_FILE: 'e2e/ide/github-issues.runtime.issue642.test.ts',
      npm_lifecycle_event: 'e2e:ide:full',
      npm_package_json: '/repo/package.json',
      npm_package_name: 'weapp-vite-monorepo',
    })

    expect(env).toEqual({
      FOO: 'bar',
    })
  })
})
