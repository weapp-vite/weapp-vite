/* eslint-disable e18e/ban-dependencies -- 真实 CLI 子进程用于验证机器可读协议和退出码。 */
import { mkdtemp } from 'node:fs/promises'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { sanitizeBuildCommandEnv } from '../utils/buildLog'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const cli = path.join(repoRoot, 'packages/weapp-vite/bin/weapp-vite.js')
const verifier = path.join(repoRoot, 'packages/weapp-vite/scripts/verify-analyze-artifacts.mjs')

interface Report {
  schemaVersion: number
  build: { id: string }
  artifacts: {
    files: Array<{ file: string, role: string, bytes: number, modules: Array<{ package?: { name: string } }> }>
    runtime: { upperBoundBytes: number }
  }
  budgetChecks: Array<{ scope: string, status: string, files: string[] }>
}

describe('analyze artifact consumer', { concurrent: false }, () => {
  it('keeps JSON clean, locates budget failures and rejects missing built files', async () => {
    await fs.ensureDir(path.join(repoRoot, '.tmp'))
    const root = await mkdtemp(path.join(repoRoot, '.tmp/analyze-artifacts-'))
    const write = async (file: string, content: string) => {
      await fs.outputFile(path.join(root, file), content)
    }
    const config = (runtimeBytes: number) => `
import { defineConfig } from 'weapp-vite'
console.log('config diagnostic must go to stderr')
export default defineConfig({
  weapp: { srcRoot: 'src', analyze: { history: false, budgets: { runtimeBytes: ${runtimeBytes} } } },
})
`
    const run = (args: string[]) => execa('node', args, {
      cwd: root,
      extendEnv: false,
      env: sanitizeBuildCommandEnv(),
      reject: false,
      timeout: 90_000,
    })
    try {
      await write('package.json', JSON.stringify({ private: true, type: 'module' }))
      await write('project.config.json', JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/' }))
      await write('project.private.config.json', JSON.stringify({ condition: { miniprogram: { list: [{ name: 'analyze', pathName: 'pages/index/index' }] } } }))
      await write('weapp-vite.config.ts', config(10_000_000))
      await write('src/app.json', JSON.stringify({ pages: ['pages/index/index'] }))
      await write('src/app.ts', 'App({})')
      await write('src/pages/index/index.ts', 'import { ref } from "wevu"; Page({ data: { count: ref(1).value } })')
      await write('src/pages/index/index.wxml', '<view>{{count}}</view>')
      const built = await run([cli, 'build', root])
      expect(built.exitCode, built.stderr || built.stdout).toBe(0)
      const analyzed = await run([cli, 'analyze', root, '--json', '--budget-check'])
      expect(analyzed.exitCode, analyzed.stderr).toBe(0)
      expect(analyzed.stderr).toContain('config diagnostic must go to stderr')
      const report = JSON.parse(analyzed.stdout) as Report
      expect(report.schemaVersion).toBe(2)
      expect(report.artifacts.runtime.upperBoundBytes).toBeGreaterThan(0)
      expect(report.artifacts.files.some(file => file.modules.some(module => module.package?.name === 'wevu'))).toBe(true)
      await write('report.json', analyzed.stdout)
      const verified = await run([verifier, 'report.json', 'dist'])
      expect(verified.exitCode, verified.stderr).toBe(0)

      const removed = report.artifacts.files.find(file => file.role === 'runtime' || file.role === 'mixed')!
      await fs.remove(path.join(root, 'dist', removed.file))
      const missing = await run([verifier, 'report.json', 'dist'])
      expect(missing.exitCode).not.toBe(0)
      expect(missing.stderr).toContain(path.basename(removed.file))

      await write('weapp-vite.config.ts', config(1))
      const failed = await run([cli, 'analyze', root, '--json', '--budget-check'])
      expect(failed.exitCode).toBe(1)
      const failure = JSON.parse(failed.stdout) as Report
      expect(failure.budgetChecks.find(item => item.scope === 'runtime')).toMatchObject({ status: 'exceeded', files: expect.arrayContaining([removed.file]) })
    }
    finally {
      await fs.remove(root)
    }
  }, 180_000)
})
