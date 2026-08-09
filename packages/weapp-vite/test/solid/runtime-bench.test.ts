/* eslint-disable e18e/ban-dependencies -- 构建集成测试需要 execa 驱动 CLI。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.join(REPO_ROOT, 'apps/runtime-bench-solid')

describe.sequential('Solid-style JSX runtime benchmark POC build', () => {
  it('emits a native WXML list without a dynamic host tree template', async () => {
    await fs.remove(path.join(APP_ROOT, 'dist'))
    await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
    })

    const appJson = await fs.readJson(path.join(APP_ROOT, 'dist/app.json')) as { pages?: string[] }
    const updateWxml = await fs.readFile(path.join(APP_ROOT, 'dist/pages/update/index.wxml'), 'utf8')
    const runnerSource = await fs.readFile(path.join(REPO_ROOT, 'e2e/scripts/run-runtime-bench.ts'), 'utf8')

    expect(appJson.pages).toContain('pages/update/index')
    expect(updateWxml).toContain('wx:for="{{cards}}"')
    expect(updateWxml).toContain('{{card.summary}}')
    expect(updateWxml).not.toContain('{{root:root}}')
    expect(runnerSource).toContain('../../apps/runtime-bench-solid')
  })
})
