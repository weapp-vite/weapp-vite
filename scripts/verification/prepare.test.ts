import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 在临时仓库验证执行前冻结检查，不启动任何真实验证任务。
import { execa } from 'execa'
import { expect, it } from 'vitest'
import { assertCommittedSnapshot, assertCurrentPlan, prepareVerificationPlan } from './prepare.ts'
import { fullRuntimeBlock } from './runtime.ts'

// 此用例串行运行真实 Git 与 pnpm 工具链探针，沿用相邻集成测试的独立预算。
it('rederives workspace, Turbo and runtime assumptions before any task executes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-freeze-'))
  const git = (args: string[]) => execa('git', args, { cwd: root })
  try {
    const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: manifest.packageManager }))
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
    await writeFile(path.join(root, 'turbo.json'), '{"tasks":{}}')
    await mkdir(path.join(root, 'packages/library/src'), { recursive: true })
    await writeFile(path.join(root, 'packages/library/package.json'), JSON.stringify({ name: 'library', scripts: { test: 'node --version' } }))
    await writeFile(path.join(root, 'packages/library/src/index.ts'), 'export {}\n')
    await git(['init', '--quiet', '--initial-branch=main'])
    await git(['add', '.'])
    await git(['-c', 'user.name=Verification Test', '-c', 'user.email=verification@example.invalid', 'commit', '--quiet', '-m', 'fixture'])
    await git(['update-ref', 'refs/remotes/origin/main', 'HEAD'])
    const options = { base: 'HEAD', files: ['packages/library/src/index.ts'], mode: 'review' as const, selection: 'affected' as const, jobs: 1 }
    const plan = await prepareVerificationPlan(root, options)
    await expect(assertCurrentPlan(root, plan, options)).resolves.toBeUndefined()
    await writeFile(path.join(root, 'turbo.json'), '{"tasks":{},"globalEnv":["CHANGED_ENV"]}')
    await expect(assertCurrentPlan(root, plan, options)).rejects.toThrow('配置')
    await writeFile(path.join(root, 'turbo.json'), '{"tasks":{}}')
    await writeFile(path.join(root, 'packages/library/package.json'), JSON.stringify({ name: 'library', scripts: { test: 'node changed.mjs' } }))
    await expect(assertCurrentPlan(root, plan, options)).rejects.toThrow('workspace')
    expect(await fullRuntimeBlock(root)).toContain('干净 main')
    await git(['restore', '.'])
    expect(await fullRuntimeBlock(root)).toBeUndefined()
    await git(['switch', '--quiet', '-c', 'feature'])
    expect(await fullRuntimeBlock(root)).toContain('干净 main')
    const head = (await git(['rev-parse', 'HEAD'])).stdout.trim()
    const committedOptions = { base: head, head, mode: 'quick' as const, jobs: 1 }
    const committed = await prepareVerificationPlan(root, committedOptions)
    await expect(assertCommittedSnapshot(root, committed, committedOptions)).resolves.toBeUndefined()
    await writeFile(path.join(root, 'packages/library/src/index.ts'), 'export const changedDuringVerification = true\n')
    await expect(assertCommittedSnapshot(root, committed, committedOptions)).rejects.toThrow('干净快照')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
