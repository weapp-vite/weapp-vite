import { describe, expect, it } from 'vitest'
import { sanitizeBuildCommandEnv } from './buildLog'

describe('buildLog', () => {
  it('strips parent pnpm script package metadata before spawning project builds', () => {
    const env = sanitizeBuildCommandEnv({
      FOO: 'bar',
      PNPM_PACKAGE_NAME: 'weapp-vite-monorepo',
      PNPM_SCRIPT_SRC_DIR: '/repo',
      npm_lifecycle_event: 'e2e:ide:full',
      npm_package_json: '/repo/package.json',
      npm_package_name: 'weapp-vite-monorepo',
    })

    expect(env).toEqual({
      FOO: 'bar',
    })
  })
})
