import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
/* eslint-disable-next-line e18e/ban-dependencies -- 验证性能脚本的真实 ESM 入口与跨平台命令执行。 */
import { execa } from 'execa'
import { expect, it } from 'vitest'

it('loads the benchmark CLI dependency graph and discovers scenarios without starting a watcher', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-benchmark-entry-'))
  const template = path.join(root, 'templates/native')
  const report = path.join(root, 'report')
  try {
    await mkdir(path.join(template, 'src'), { recursive: true })
    await writeFile(path.join(template, 'package.json'), '{"name":"native"}')
    await writeFile(path.join(template, 'weapp-vite.config.ts'), 'export default {}')
    await writeFile(path.join(template, 'src/app.json'), '{"pages":[]}')
    const result = await execa(process.execPath, ['--import', 'tsx', 'scripts/benchmark-templates-hmr.ts'], {
      cwd: path.resolve(import.meta.dirname, '../..'),
      env: {
        TEMPLATES_HMR_REPO_ROOT: root,
        TEMPLATES_HMR_WORKSPACE_ROOT: path.join(root, 'workspace'),
        TEMPLATES_HMR_REPORT_DIR: report,
        TEMPLATES_HMR_PLAN_ONLY: '1',
        TEMPLATES_HMR_FILTER: 'native',
        TEMPLATES_HMR_SCENARIO_FILTER: 'app-json',
      },
    })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(await readFile(path.join(report, 'manifest.json'), 'utf8'))).toEqual([
      { id: 'native', scenarios: ['app-json'] },
    ])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
