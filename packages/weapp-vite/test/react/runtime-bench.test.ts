/* eslint-disable e18e/ban-dependencies -- 构建集成测试需要 execa 驱动 CLI。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.join(REPO_ROOT, 'apps/runtime-bench-react')

describe.sequential('React runtime benchmark build', () => {
  it('keeps dynamic and static benchmark render modes distinct', async () => {
    await fs.remove(path.join(APP_ROOT, 'dist'))
    await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
    })

    const appJson = await fs.readJson(path.join(APP_ROOT, 'dist/app.json')) as { pages?: string[] }
    const dynamicWxml = await fs.readFile(path.join(APP_ROOT, 'dist/pages/update/index.wxml'), 'utf8')
    const staticWxml = await fs.readFile(path.join(APP_ROOT, 'dist/pages/static-update/index.wxml'), 'utf8')
    const runnerSource = await fs.readFile(path.join(REPO_ROOT, 'e2e/scripts/run-runtime-bench.ts'), 'utf8')
    const updateSource = await fs.readFile(path.join(APP_ROOT, 'src/pages/update/index.ts'), 'utf8')

    expect(appJson.pages).toContain('pages/static-update/index')
    expect(dynamicWxml).toContain('{{root:root}}')
    expect(staticWxml).toContain('{{slots.s3.text}}')
    expect(staticWxml).not.toContain('{{root:root}}')
    expect(runnerSource).toContain('../../apps/runtime-bench-react')
    expect(updateSource).toContain('runtime.root.render')
  })
})
