import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const RACE_GUARD_PATH = path.resolve(import.meta.dirname, '../helpers/fs-copy-race-guard.cjs')
const APP_ROOT = path.resolve(import.meta.dirname, '../../packages/weapp-vite/test/fixtures/subPackages-dependencies')

describe.sequential('npm build race guard e2e', () => {
  it('builds npm dependencies without same-destination concurrent copy races', async () => {
    const distRoot = path.resolve(APP_ROOT, 'dist')
    await fs.remove(distRoot)

    await execa('node', [
      '--require',
      RACE_GUARD_PATH,
      CLI_PATH,
      'build',
      APP_ROOT,
      '--platform',
      'weapp',
    ], {
      cwd: APP_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        WEAPP_VITE_TEST_COPY_RACE_GUARD: '1',
      },
    })

    expect(await fs.pathExists(path.resolve(distRoot, 'miniprogram_npm/class-variance-authority/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(distRoot, 'miniprogram_npm/clsx/index.js'))).toBe(true)
    expect(await fs.pathExists(path.resolve(distRoot, 'miniprogram_npm/dayjs/index.js'))).toBe(true)
  })
})
